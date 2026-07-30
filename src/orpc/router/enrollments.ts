import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { authed } from '#/orpc/context'
import { enrollmentClaims, enrollmentTokens } from '#/db/schema'
import {
  actorFrom,
  type AuditingContext,
  recordAuditEvent,
} from '#/lib/audit-service'
import { decryptSecret, encryptSecret } from '#/lib/crypto'
import {
  enrollmentTokenPrefix,
  generateEnrollmentToken,
  hashEnrollmentToken,
} from '#/lib/enrollment'
import {
  buildDeploymentScripts,
  DEFAULT_RUSTDESK_VERSION,
} from '#/lib/deployment-script'

const TokenKindSchema = z.enum(['single', 'permanent'])

const BaseUrlSchema = z.object({ baseUrl: z.string().url() })

function deploymentOrigin(inputBaseUrl: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL?.trim() || inputBaseUrl
  const publicUrl = new URL(baseUrl)
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(
    publicUrl.hostname,
  )
  if (publicUrl.protocol !== 'https:' && !isLoopback) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Deployment scripts require a public HTTPS URL.',
    })
  }
  return publicUrl.origin
}

function accessibleToken(
  id: string,
  userId: string,
  role: string | null | undefined,
) {
  return role === 'admin'
    ? eq(enrollmentTokens.id, id)
    : and(eq(enrollmentTokens.id, id), eq(enrollmentTokens.createdBy, userId))
}

/** Actor + target snapshot for an audit event about an enrollment token. */
function enrollmentAuditEvent(
  context: AuditingContext,
  row: { id: string; name: string },
) {
  return {
    actor: actorFrom(context),
    target: {
      type: 'enrollment_token' as const,
      id: row.id,
      label: row.name,
    },
    headers: context.headers,
  }
}

const CreateEnrollmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: TokenKindSchema,
  installIfMissing: z.boolean().default(true),
  customer: z.string().trim().max(160).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(40)).max(24).default([]),
  rustdeskConfig: z.string().trim().max(4000).optional().default(''),
  baseUrl: z.string().url(),
})

export const create = authed
  .input(CreateEnrollmentSchema)
  .handler(async ({ input, context }) => {
    const token = generateEnrollmentToken()
    const tags = [
      ...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)),
    ]
    const rustdeskVersion = DEFAULT_RUSTDESK_VERSION
    const origin = deploymentOrigin(input.baseUrl)

    const [row] = await context.db
      .insert(enrollmentTokens)
      .values({
        name: input.name,
        tokenHash: hashEnrollmentToken(token),
        tokenCipher: input.kind === 'permanent' ? encryptSecret(token) : null,
        tokenPrefix: enrollmentTokenPrefix(token),
        kind: input.kind,
        installIfMissing: input.installIfMissing,
        customer: input.customer || null,
        tags,
        rustdeskConfig: input.rustdeskConfig || null,
        createdBy: context.user.id,
      })
      .returning({ id: enrollmentTokens.id })

    // The token VALUE is returned to the caller but never recorded — only its
    // prefix, which is what the token list shows too.
    await recordAuditEvent(context.db, {
      action: 'enrollment_token_created',
      ...enrollmentAuditEvent(context, { id: row.id, name: input.name }),
      metadata: {
        kind: input.kind,
        tokenPrefix: enrollmentTokenPrefix(token),
        customer: input.customer || null,
      },
    })

    return {
      id: row.id,
      kind: input.kind,
      token,
      rustdeskVersion,
      scripts: buildDeploymentScripts({
        baseUrl: origin,
        token,
        installIfMissing: input.installIfMissing,
        rustdeskConfig: input.rustdeskConfig,
      }),
    }
  })

export const list = authed.handler(async ({ context }) => {
  const rows = await context.db
    .select({
      id: enrollmentTokens.id,
      name: enrollmentTokens.name,
      tokenPrefix: enrollmentTokens.tokenPrefix,
      kind: enrollmentTokens.kind,
      installIfMissing: enrollmentTokens.installIfMissing,
      customer: enrollmentTokens.customer,
      tags: enrollmentTokens.tags,
      useCount: enrollmentTokens.useCount,
      usedAt: enrollmentTokens.usedAt,
      lastUsedAt: enrollmentTokens.lastUsedAt,
      revokedAt: enrollmentTokens.revokedAt,
      createdAt: enrollmentTokens.createdAt,
    })
    .from(enrollmentTokens)
    .where(
      context.user.role === 'admin'
        ? undefined
        : eq(enrollmentTokens.createdBy, context.user.id),
    )
    .orderBy(desc(enrollmentTokens.createdAt))

  return rows.map((row) => ({
    ...row,
    usedAt: row.usedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }))
})

export const scripts = authed
  .input(BaseUrlSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const origin = deploymentOrigin(input.baseUrl)
    return context.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(enrollmentTokens)
        .where(accessibleToken(input.id, context.user.id, context.user.role))
        .limit(1)
        .for('update')

      if (!row) throw new ORPCError('NOT_FOUND')
      if (row.kind !== 'permanent') {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Scripts can only be downloaded again for permanent tokens.',
        })
      }
      if (row.revokedAt) {
        throw new ORPCError('BAD_REQUEST', {
          message:
            'Revoked tokens cannot be used to generate deployment scripts.',
        })
      }

      let token: string
      let rotated = false
      if (row.tokenCipher) {
        token = decryptSecret(row.tokenCipher)
      } else {
        // Tokens created before reversible storage was introduced cannot be
        // recovered from their hash. Rotate them once so future downloads work.
        token = generateEnrollmentToken()
        rotated = true
        await tx
          .update(enrollmentTokens)
          .set({
            tokenHash: hashEnrollmentToken(token),
            tokenCipher: encryptSecret(token),
            tokenPrefix: enrollmentTokenPrefix(token),
          })
          .where(eq(enrollmentTokens.id, row.id))
      }

      return {
        id: row.id,
        kind: 'permanent' as const,
        rustdeskVersion: DEFAULT_RUSTDESK_VERSION,
        rotated,
        scripts: buildDeploymentScripts({
          baseUrl: origin,
          token,
          installIfMissing: row.installIfMissing,
          rustdeskConfig: row.rustdeskConfig ?? '',
        }),
      }
    })
  })

export const remove = authed
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) =>
    context.db.transaction(async (tx) => {
      const [token] = await tx
        .select({ id: enrollmentTokens.id })
        .from(enrollmentTokens)
        .where(accessibleToken(input.id, context.user.id, context.user.role))
        .limit(1)
        .for('update')
      if (!token) return { ok: false }

      const [activeClaim] = await tx
        .select({ id: enrollmentClaims.id })
        .from(enrollmentClaims)
        .where(
          and(
            eq(enrollmentClaims.tokenId, token.id),
            isNull(enrollmentClaims.finalizedAt),
            gt(enrollmentClaims.expiresAt, new Date()),
          ),
        )
        .limit(1)
      if (activeClaim) {
        throw new ORPCError('CONFLICT', {
          message:
            'This token currently has an active enrollment. Complete it or wait for the claim to expire before deleting the token.',
        })
      }

      await tx.delete(enrollmentTokens).where(eq(enrollmentTokens.id, token.id))
      return { ok: true }
    }),
  )

export const revoke = authed
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    const [row] = await context.db
      .update(enrollmentTokens)
      .set({ revokedAt: new Date() })
      .where(accessibleToken(input.id, context.user.id, context.user.role))
      .returning({ id: enrollmentTokens.id, name: enrollmentTokens.name })
    if (row) {
      await recordAuditEvent(context.db, {
        action: 'enrollment_token_revoked',
        ...enrollmentAuditEvent(context, row),
      })
    }
    return { ok: Boolean(row) }
  })
