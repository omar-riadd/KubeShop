{{/*
App name — Rollout metadata.name MUST equal app.name so pod names are <app>-<hash>-<rand>
*/}}
{{- define "kubeshop.name" -}}
{{- .Values.app.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Standard Kubernetes recommended labels
*/}}
{{- define "kubeshop.labels" -}}
app.kubernetes.io/name: {{ include "kubeshop.name" . }}
app.kubernetes.io/instance: {{ include "kubeshop.name" . }}
app.kubernetes.io/part-of: kubeshop
app.kubernetes.io/component: {{ .Values.app.kind }}
app.kubernetes.io/version: {{ .Values.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
kubeshop.io/env: {{ .Values.app.environment }}
{{- end -}}

{{/*
Pod selector labels
*/}}
{{- define "kubeshop.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kubeshop.name" . }}
app.kubernetes.io/instance: {{ include "kubeshop.name" . }}
{{- end -}}
