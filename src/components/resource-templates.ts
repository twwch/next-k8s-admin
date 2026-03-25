export const RESOURCE_TEMPLATES: Record<string, { label: string; yaml: string }[]> = {
  deployments: [
    {
      label: 'Deployment 基础',
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:latest
          ports:
            - containerPort: 80`,
    },
    {
      label: 'Deployment + Service',
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:latest
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: my-app
  namespace: default
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP`,
    },
  ],
  statefulsets: [
    {
      label: 'StatefulSet',
      yaml: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-statefulset
  namespace: default
spec:
  serviceName: my-statefulset
  replicas: 1
  selector:
    matchLabels:
      app: my-statefulset
  template:
    metadata:
      labels:
        app: my-statefulset
    spec:
      containers:
        - name: my-statefulset
          image: nginx:latest
          ports:
            - containerPort: 80`,
    },
  ],
  daemonsets: [
    {
      label: 'DaemonSet',
      yaml: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-daemonset
  namespace: default
spec:
  selector:
    matchLabels:
      app: my-daemonset
  template:
    metadata:
      labels:
        app: my-daemonset
    spec:
      containers:
        - name: my-daemonset
          image: nginx:latest`,
    },
  ],
  jobs: [
    {
      label: 'CronJob',
      yaml: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
  namespace: default
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: my-job
              image: busybox
              command: ["echo", "hello"]
          restartPolicy: OnFailure`,
    },
  ],
  services: [
    {
      label: 'Service',
      yaml: `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: default
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP`,
    },
  ],
  configmaps: [
    {
      label: 'ConfigMap',
      yaml: `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
data:
  key: value`,
    },
  ],
  secrets: [
    {
      label: 'Secret',
      yaml: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
type: Opaque
data:
  username: YWRtaW4=
  password: cGFzc3dvcmQ=`,
    },
  ],
  ingresses: [
    {
      label: 'Ingress',
      yaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: default
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 80`,
    },
  ],
  persistentvolumeclaims: [
    {
      label: 'PVC',
      yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`,
    },
  ],
  storageclasses: [
    {
      label: 'StorageClass',
      yaml: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: my-storageclass
provisioner: kubernetes.io/no-provisioner
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer`,
    },
  ],
  namespaces: [
    {
      label: 'Namespace',
      yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace`,
    },
  ],
};
