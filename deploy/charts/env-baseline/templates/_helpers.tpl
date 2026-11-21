{{- define "baseline.commonLabels" -}}
app.kubernetes.io/part-of: kubeshop
app.kubernetes.io/managed-by: {{ .Release.Service }}
kubeshop.io/env: {{ .Values.environment }}
{{- end -}}
