export interface ParsedRunEvidenceId {
  runId: string
  evidenceId: string
}

interface EvidenceLike {
  id?: string | null
  evidence_id?: string | null
  run_id?: string | null
  local_evidence_id?: string | null
  run_evidence_id?: string | null
}

interface EvidenceLinkLike {
  evidence_id?: string | null
  run_id?: string | null
}

export function makeRunEvidenceId(runId?: string | null, evidenceId?: string | null): string | null {
  if (!evidenceId) return null
  const parsed = parseRunEvidenceId(evidenceId)
  if (parsed) return evidenceId
  return runId ? `${runId}:${evidenceId}` : evidenceId
}

export function parseRunEvidenceId(runEvidenceId?: string | null): ParsedRunEvidenceId | null {
  if (!runEvidenceId) return null
  const separator = runEvidenceId.indexOf(':')
  if (separator <= 0 || separator === runEvidenceId.length - 1) return null
  return {
    runId: runEvidenceId.slice(0, separator),
    evidenceId: runEvidenceId.slice(separator + 1),
  }
}

export function getLocalEvidenceId(id?: string | null): string | null {
  if (!id) return null
  return parseRunEvidenceId(id)?.evidenceId ?? id
}

export function attachRunEvidenceMetadata<T extends EvidenceLike>(evidence: T, runId?: string | null): T & {
  local_evidence_id?: string | null
  run_id?: string | null
  run_evidence_id?: string | null
} {
  const localId = evidence.local_evidence_id ?? getLocalEvidenceId(evidence.id ?? evidence.evidence_id)
  return {
    ...evidence,
    local_evidence_id: localId,
    run_id: evidence.run_id ?? runId ?? null,
    run_evidence_id: evidence.run_evidence_id ?? makeRunEvidenceId(evidence.run_id ?? runId, localId),
  }
}

export function evidenceMatches(
  link: EvidenceLinkLike,
  evidence: EvidenceLike,
  runId?: string | null,
): boolean {
  const linkLocalId = getLocalEvidenceId(link.evidence_id)
  const evidenceLocalId = evidence.local_evidence_id ?? getLocalEvidenceId(evidence.id ?? evidence.evidence_id)
  if (!linkLocalId || !evidenceLocalId || linkLocalId !== evidenceLocalId) return false
  const linkRunId = link.run_id ?? parseRunEvidenceId(link.evidence_id)?.runId ?? null
  const evidenceRunId = evidence.run_id ?? runId ?? parseRunEvidenceId(evidence.id ?? evidence.evidence_id)?.runId ?? null
  return !linkRunId || !evidenceRunId || linkRunId === evidenceRunId
}
