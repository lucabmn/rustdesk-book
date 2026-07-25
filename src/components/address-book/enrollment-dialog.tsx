import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Dialog, DialogBody } from '#/components/ui'
import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'
import {
  EnrollmentScriptPanel,
  PLATFORMS,
  type CreatedEnrollment,
  type Platform,
} from './enrollment-script-panel'
import { EnrollmentForm } from './enrollment-form'
import { EnrollmentTokenList } from './enrollment-token-list'

export function EnrollmentDialog({
  open,
  onOpenChange,
  customerNames,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerNames: string[]
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [created, setCreated] = useState<CreatedEnrollment | null>(null)
  const [scriptSaved, setScriptSaved] = useState(false)
  const [platform, setPlatform] = useState<Platform>('windows')

  const listQuery = useQuery(
    orpc.enrollments.list.queryOptions({ input: {}, enabled: open }),
  )
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.enrollments.key() })

  const createMut = useMutation(
    orpc.enrollments.create.mutationOptions({
      onSuccess: (result) => {
        setCreated(result)
        setScriptSaved(false)
        setPlatform('windows')
        invalidate()
        toast(m.enrollment_created())
      },
      onError: (error) => toast(error.message),
    }),
  )
  const scriptsMut = useMutation(
    orpc.enrollments.scripts.mutationOptions({
      onSuccess: (result) => {
        setCreated(result)
        setScriptSaved(false)
        setPlatform('windows')
        if (result.rotated) toast(m.enrollment_token_rotated())
      },
      onError: (error) => toast(error.message),
    }),
  )
  const revokeMut = useMutation(
    orpc.enrollments.revoke.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.enrollment_revoked())
      },
      onError: (error) => toast(error.message),
    }),
  )
  const removeMut = useMutation(
    orpc.enrollments.remove.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.enrollment_deleted())
      },
      onError: (error) => toast(error.message),
    }),
  )

  async function copyScript() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.scripts[platform])
      setScriptSaved(true)
      toast(m.enrollment_script_copied())
    } catch {
      toast(m.enrollment_copy_failed())
    }
  }

  function downloadScript() {
    if (!created) return
    const meta = PLATFORMS.find((item) => item.id === platform)!
    const blob = new Blob([created.scripts[platform]], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rustdesk-book-deploy-${platform}.${meta.extension}`
    link.click()
    setScriptSaved(true)
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A single-use token is unrecoverable once this closes.
        if (
          !next &&
          created?.kind === 'single' &&
          !scriptSaved &&
          !window.confirm(m.enrollment_close_warning())
        ) {
          return
        }
        onOpenChange(next)
        if (!next) setCreated(null)
      }}
      title={m.enrollment_title()}
      description={m.enrollment_description()}
      width={760}
    >
      <DialogBody>
        {created ? (
          <EnrollmentScriptPanel
            created={created}
            platform={platform}
            onPlatform={setPlatform}
            onCopy={copyScript}
            onDownload={downloadScript}
            onCreateAnother={() => setCreated(null)}
          />
        ) : (
          <>
            <EnrollmentForm
              customerNames={customerNames}
              busy={createMut.isPending}
              onSubmit={(values) =>
                createMut.mutate({ ...values, baseUrl: window.location.origin })
              }
            />

            <EnrollmentTokenList
              tokens={listQuery.data ?? []}
              scriptsPending={scriptsMut.isPending}
              removePending={removeMut.isPending}
              onDownloadAgain={(id) =>
                scriptsMut.mutate({ id, baseUrl: window.location.origin })
              }
              onRevoke={(id) => revokeMut.mutate({ id })}
              onDelete={(token) => {
                if (
                  window.confirm(
                    m.enrollment_delete_confirm({ name: token.name }),
                  )
                ) {
                  removeMut.mutate({ id: token.id })
                }
              }}
            />
          </>
        )}
      </DialogBody>
    </Dialog>
  )
}
