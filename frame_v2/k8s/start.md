bala@bala-MacBookPro:~/BeatNect/frame_v2$ kubectl get pods -o wide
NAME                        READY   STATUS    RESTARTS   AGE     IP           NODE       NOMINATED NODE   READINESS GATES
frame-v2-5664c6bfd6-f9pxr   0/1     Pending   0          55s     <none>       <none>     <none>           <none>
frame-v2-784dc6fff-4vhmg    0/1     Pending   0          4m59s   <none>       <none>     <none>           <none>
frame-v2-784dc6fff-sctz4    0/1     Pending   0          4m59s   <none>       <none>     <none>           <none>
frame-v2-784dc6fff-xmfdk    0/1     Pending   0          4m59s   <none>       <none>     <none>           <none>
postgres-0                  1/1     Running   0          54s     10.244.0.5   minikube   <none>           <none>
bala@bala-MacBookPro:~/BeatNect/frame_v2$ kubectl describe frame-v2-5664c6bfd6-f9pxr
error: the server doesn't have a resource type "frame-v2-5664c6bfd6-f9pxr"
bala@bala-MacBookPro:~/BeatNect/frame_v2$ kubectl logs frame-v2-5664c6bfd6-f9pxr
bala@bala-MacBookPro:~/BeatNect/frame_v2$ kubectl describe pod frame-v2-5664c6bfd6-f9pxr
Name:             frame-v2-5664c6bfd6-f9pxr
Namespace:        default
Priority:         0
Service Account:  default
Node:             <none>
Labels:           app=frame-v2
                  pod-template-hash=5664c6bfd6
Annotations:      kubectl.kubernetes.io/restartedAt: 2026-09-07T16:33:15+05:30
Status:           Pending
IP:               
IPs:              <none>
Controlled By:    ReplicaSet/frame-v2-5664c6bfd6
Containers:
  frame-container:
    Image:      balu051989/frame_v2-web:latest
    Port:       5000/TCP
    Host Port:  0/TCP
    Limits:
      cpu:     500m
      memory:  512Mi
    Requests:
      cpu:     250m
      memory:  256Mi
    Environment:
      DB_HOST:      postgres
      DB_NAME:      notepad
      DB_USER:      notepad
      DB_PASSWORD:  notepad
      REDIS_TTL:    3600
    Mounts:
      /app/data from storage (rw)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-pvsxb (ro)
Conditions:
  Type           Status
  PodScheduled   False 
Volumes:
  storage:
    Type:       PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)
    ClaimName:  frame-pvc
    ReadOnly:   false
  nginx-config:
    Type:      ConfigMap (a volume populated by a ConfigMap)
    Name:      nginx-config
    Optional:  false
  ssl-certs:
    Type:        Secret (a volume populated by a Secret)
    SecretName:  frame-ssl-secret
    Optional:    false
  kube-api-access-pvsxb:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    Optional:                false
    DownwardAPI:             true
QoS Class:                   Burstable
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type     Reason            Age    From               Message
  ----     ------            ----   ----               -------
  Warning  FailedScheduling  2m25s  default-scheduler  0/1 nodes are available: persistentvolumeclaim "frame-pvc" not found. not found
bala@bala-MacBookPro:~/BeatNect/frame_v2$ kubectl get pvc -A
NAMESPACE   NAME                STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
default     pgdata-postgres-0   Bound    pvc-2bd3e38b-68b3-4990-abac-41170b75c829   32Gi       RWO            standard       <unset>                 7m10s
bala@bala-MacBookPro:~/BeatNect/frame_v2$ cd k8s/
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ nano frame
frame_postgre_pod.yaml      frame_postgre_service.yaml  frame-v2-service.yaml       
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ nano frame
frame_postgre_pod.yaml      frame_postgre_service.yaml  frame-v2-service.yaml       
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ nano frame-v2-service.yaml 
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ nano frame_postgre_pod.yaml 
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ nano frame_postgre_service.yaml 
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ ls
ansible-pod.yaml        deployment.yaml     frame_postgre_pod.yaml      frame-v2-service.yaml  jenkins-clusterrolebinding.yaml  jenkins-pvc.yaml  jenkins-service.yaml  postgres-service.yaml      redis-configmap.yaml   redis-pvc.yaml
apples-MacBook-Pro:k8s  Dockerfile.jenkins  frame_postgre_service.yaml  index.html             jenkins-deployment.yaml          jenkins-sa.yaml   nohup.out             postgres-statefulset.yaml  redis-deployment.yaml  redis-service.yaml
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ vi frame_postgre_
frame_postgre_pod.yaml      frame_postgre_service.yaml  
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ vi frame_postgre_pod.yaml 
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl apply *.yaml
error: Unexpected args: [ansible-pod.yaml deployment.yaml frame_postgre_pod.yaml frame_postgre_service.yaml frame-v2-service.yaml jenkins-clusterrolebinding.yaml jenkins-deployment.yaml jenkins-pvc.yaml jenkins-sa.yaml jenkins-service.yaml postgres-service.yaml postgres-statefulset.yaml redis-configmap.yaml redis-deployment.yaml redis-pvc.yaml redis-service.yaml]
See 'kubectl apply -h' for help and examples
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl apply frame_postgre_pod.yaml
error: Unexpected args: [frame_postgre_pod.yaml]
See 'kubectl apply -h' for help and examples
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl apply -f *.yaml
error: Unexpected args: [deployment.yaml frame_postgre_pod.yaml frame_postgre_service.yaml frame-v2-service.yaml jenkins-clusterrolebinding.yaml jenkins-deployment.yaml jenkins-pvc.yaml jenkins-sa.yaml jenkins-service.yaml postgres-service.yaml postgres-statefulset.yaml redis-configmap.yaml redis-deployment.yaml redis-pvc.yaml redis-service.yaml]
See 'kubectl apply -h' for help and examples
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl apply -f frame_postgre_pod.yaml
pod/frame-postgre created
configmap/nginx-config created
configmap/dnsmasq-config created
Warning: tls: failed to find any PEM data in certificate input
secret/frame-ssl-secret created
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS              RESTARTS   AGE
frame-postgre               0/4     ContainerCreating   0          12s
frame-v2-5664c6bfd6-f9pxr   0/1     Pending             0          10m
frame-v2-784dc6fff-4vhmg    0/1     Pending             0          14m
frame-v2-784dc6fff-sctz4    0/1     Pending             0          14m
frame-v2-784dc6fff-xmfdk    0/1     Pending             0          14m
postgres-0                  1/1     Running             0          10m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS              RESTARTS   AGE
frame-postgre               0/4     ContainerCreating   0          26s
frame-v2-5664c6bfd6-f9pxr   0/1     Pending             0          10m
frame-v2-784dc6fff-4vhmg    0/1     Pending             0          14m
frame-v2-784dc6fff-sctz4    0/1     Pending             0          14m
frame-v2-784dc6fff-xmfdk    0/1     Pending             0          14m
postgres-0                  1/1     Running             0          10m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS              RESTARTS   AGE
frame-postgre               2/4     ErrImageNeverPull   0          48s
frame-v2-5664c6bfd6-f9pxr   0/1     Pending             0          11m
frame-v2-784dc6fff-4vhmg    0/1     Pending             0          15m
frame-v2-784dc6fff-sctz4    0/1     Pending             0          15m
frame-v2-784dc6fff-xmfdk    0/1     Pending             0          15m
postgres-0                  1/1     Running             0          11m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl 
kubectl controls the Kubernetes cluster manager.

 Find more information at: https://kubernetes.io/docs/reference/kubectl/

Basic Commands (Beginner):
  create          Create a resource from a file or from stdin
  expose          Take a replication controller, service, deployment or pod and expose it as a new Kubernetes service
  run             Run a particular image on the cluster
  set             Set specific features on objects

Basic Commands (Intermediate):
  explain         Get documentation for a resource
  get             Display one or many resources
  edit            Edit a resource on the server
  delete          Delete resources by file names, stdin, resources and names, or by resources and label selector

Deploy Commands:
  rollout         Manage the rollout of a resource
  scale           Set a new size for a deployment, replica set, or replication controller
  autoscale       Auto-scale a deployment, replica set, stateful set, or replication controller

Cluster Management Commands:
  certificate     Modify certificate resources
  cluster-info    Display cluster information
  top             Display resource (CPU/memory) usage
  cordon          Mark node as unschedulable
  uncordon        Mark node as schedulable
  drain           Drain node in preparation for maintenance
  taint           Update the taints on one or more nodes

Troubleshooting and Debugging Commands:
  describe        Show details of a specific resource or group of resources
  logs            Print the logs for a container in a pod
  attach          Attach to a running container
  exec            Execute a command in a container
  port-forward    Forward one or more local ports to a pod
  proxy           Run a proxy to the Kubernetes API server
  cp              Copy files and directories to and from containers
  auth            Inspect authorization
  debug           Create debugging sessions for troubleshooting workloads and nodes
  events          List events

Advanced Commands:
  diff            Diff the live version against a would-be applied version
  apply           Apply a configuration to a resource by file name or stdin
  patch           Update fields of a resource
  replace         Replace a resource by file name or stdin
  wait            Wait for a specific condition on one or many resources
  kustomize       Build a kustomization target from a directory or URL

Settings Commands:
  label           Update the labels on a resource
  annotate        Update the annotations on a resource
  completion      Output shell completion code for the specified shell (bash, zsh, fish, or powershell)

Subcommands provided by plugins:

Other Commands:
  api-resources   Print the supported API resources on the server
  api-versions    Print the supported API versions on the server, in the form of "group/version"
  config          Modify kubeconfig files
  kuberc          Manage kuberc configuration files
  plugin          Provides utilities for interacting with plugins
  version         Print the client and server version information

Usage:
  kubectl [flags] [options]

Use "kubectl <command> --help" for more information about a given command.
Use "kubectl options" for a list of global command-line options (applies to all commands).
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl delete pod frame-postgre
pod "frame-postgre" deleted from default namespace
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS    RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   0/1     Pending   0          11m
frame-v2-784dc6fff-4vhmg    0/1     Pending   0          15m
frame-v2-784dc6fff-sctz4    0/1     Pending   0          15m
frame-v2-784dc6fff-xmfdk    0/1     Pending   0          15m
postgres-0                  1/1     Running   0          11m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ ls
ansible-pod.yaml        deployment.yaml     frame_postgre_pod.yaml      frame-v2-service.yaml  jenkins-clusterrolebinding.yaml  jenkins-pvc.yaml  jenkins-service.yaml  postgres-service.yaml      redis-configmap.yaml   redis-pvc.yaml
apples-MacBook-Pro:k8s  Dockerfile.jenkins  frame_postgre_service.yaml  index.html             jenkins-deployment.yaml          jenkins-sa.yaml   nohup.out             postgres-statefulset.yaml  redis-deployment.yaml  redis-service.yaml
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ cat > frame-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: frame-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ vi frame-pvc.yaml 
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ nano frame-pvc.yaml 
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl apply -f frame-pvc.yaml
persistentvolumeclaim/frame-pvc created
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS              RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   0/1     ContainerCreating   0          13m
frame-v2-784dc6fff-4vhmg    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-sctz4    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-xmfdk    0/1     ContainerCreating   0          17m
postgres-0                  1/1     Running             0          13m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS              RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   0/1     ContainerCreating   0          13m
frame-v2-784dc6fff-4vhmg    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-sctz4    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-xmfdk    0/1     ContainerCreating   0          17m
postgres-0                  1/1     Running             0          13m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS              RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   0/1     ContainerCreating   0          13m
frame-v2-784dc6fff-4vhmg    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-sctz4    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-xmfdk    0/1     ContainerCreating   0          17m
postgres-0                  1/1     Running             0          13m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods -w
NAME                        READY   STATUS              RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   1/1     Running             0          13m
frame-v2-5664c6bfd6-l7v8h   0/1     ContainerCreating   0          1s
frame-v2-784dc6fff-4vhmg    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-sctz4    0/1     ContainerCreating   0          17m
frame-v2-784dc6fff-xmfdk    0/1     Terminating         0          17m
postgres-0                  1/1     Running             0          13m
frame-v2-5664c6bfd6-l7v8h   0/1     ContainerCreating   0          1s
frame-v2-784dc6fff-4vhmg    1/1     Running             0          17m
frame-v2-784dc6fff-xmfdk    1/1     Terminating         0          18m
frame-v2-784dc6fff-sctz4    1/1     Running             0          18m
frame-v2-5664c6bfd6-l7v8h   1/1     Running             0          10s
frame-v2-784dc6fff-sctz4    1/1     Terminating         0          18m
frame-v2-5664c6bfd6-lz87l   0/1     Pending             0          0s
frame-v2-784dc6fff-sctz4    1/1     Terminating         0          18m
frame-v2-5664c6bfd6-lz87l   0/1     Pending             0          0s
frame-v2-5664c6bfd6-lz87l   0/1     ContainerCreating   0          1s
frame-v2-5664c6bfd6-lz87l   0/1     ContainerCreating   0          1s
frame-v2-5664c6bfd6-lz87l   1/1     Running             0          4s
frame-v2-784dc6fff-4vhmg    1/1     Terminating         0          18m
frame-v2-784dc6fff-4vhmg    1/1     Terminating         0          18m
^Cbala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS        RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   1/1     Running       0          14m
frame-v2-5664c6bfd6-l7v8h   1/1     Running       0          27s
frame-v2-5664c6bfd6-lz87l   1/1     Running       0          17s
frame-v2-784dc6fff-4vhmg    1/1     Terminating   0          18m
frame-v2-784dc6fff-sctz4    1/1     Terminating   0          18m
frame-v2-784dc6fff-xmfdk    1/1     Terminating   0          18m
postgres-0                  1/1     Running       0          14m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get pods
NAME                        READY   STATUS    RESTARTS   AGE
frame-v2-5664c6bfd6-f9pxr   1/1     Running   0          15m
frame-v2-5664c6bfd6-l7v8h   1/1     Running   0          99s
frame-v2-5664c6bfd6-lz87l   1/1     Running   0          89s
postgres-0                  1/1     Running   0          15m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ minikube service frame-v2 --url

❌  Exiting due to GUEST_STATUS: Unable to get control-plane node minikube host status: state: unknown state "minikube": docker container inspect minikube --format={{.State.Status}}: exit status 1
stdout:


stderr:
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock


bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ minikube status
E0907 16:49:40.563259  154313 status.go:178] status error: host: state: unknown state "minikube": docker container inspect minikube --format={{.State.Status}}: exit status 1
stdout:


stderr:
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
E0907 16:49:40.563304  154313 status.go:127] status error: host: state: unknown state "minikube": docker container inspect minikube --format={{.State.Status}}: exit status 1
stdout:


stderr:
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ sudo minikube service frame-v2 --url
[sudo] password for bala:      
🤷  Profile "minikube" not found. Run "minikube profile list" to view all profiles.
👉  To start a cluster, run: "minikube start"
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ minikube start
😄  minikube v1.39.0 on Linuxmint 22.3
✨  Using the docker driver based on existing profile

💣  Exiting due to PROVIDER_DOCKER_NEWGRP: "docker version --format <no value>-<no value>:<no value>" exit status 1: permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
💡  Suggestion: Add your user to the 'docker' group: 'sudo usermod -aG docker $USER && newgrp docker'
📘  Documentation: https://docs.docker.com/engine/install/linux-postinstall/

bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ sudo usermod -aG docker $USER && newgrp docke
newgrp: group 'docke' does not exist
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ sudo usermod -aG docker $USER && newgrp docker
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ minikube start
😄  minikube v1.39.0 on Linuxmint 22.3
✨  Using the docker driver based on existing profile
👍  Starting "minikube" primary control-plane node in "minikube" cluster
🚜  Pulling base image v0.0.51 ...
🏃  Updating the running docker "minikube" container ...
📦  Preparing Kubernetes v1.37.0 on containerd 2.3.4 ...
🔎  Verifying Kubernetes components...
    ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
🌟  Enabled addons: default-storageclass, storage-provisioner
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ pwd^C
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ minikube service frame-v2 --url
http://192.168.49.2:30080
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 5001:5000
error: Service frame-v2 does not have a service port 5000
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 5001:30080
error: Service frame-v2 does not have a service port 30080
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 5001:5000
error: Service frame-v2 does not have a service port 5000
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl get svc frame-v2
NAME       TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
frame-v2   LoadBalancer   10.107.244.185   <pending>     8080:30080/TCP   24m
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 5001:8080
Forwarding from 127.0.0.1:5001 -> 5000
Forwarding from [::1]:5001 -> 5000
^Cbala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 80:8080
Unable to listen on port 80: Listeners failed to create with the following errors: [unable to create listener: Error listen tcp4 127.0.0.1:80: bind: permission denied unable to create listener: Error listen tcp6 [::1]:80: bind: permission denied]
error: unable to listen on any of the requested ports: [{80 5000}]
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 8080:8080
Forwarding from 127.0.0.1:8080 -> 5000
Forwarding from [::1]:8080 -> 5000
^Cbala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 80:8080
Unable to listen on port 80: Listeners failed to create with the following errors: [unable to create listener: Error listen tcp4 127.0.0.1:80: bind: permission denied unable to create listener: Error listen tcp6 [::1]:80: bind: permission denied]
error: unable to listen on any of the requested ports: [{80 5000}]
bala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 8000:8080
Forwarding from 127.0.0.1:8000 -> 5000
Forwarding from [::1]:8000 -> 5000
Handling connection for 8000
Handling connection for 8000
E0907 16:58:20.040549  157111 portforward.go:525] "Error copying from local connection to remote stream" err="writeto tcp4 127.0.0.1:8000->127.0.0.1:47152: read tcp4 127.0.0.1:8000->127.0.0.1:47152: read: connection reset by peer" localPort=8000 remotePort=5000
E0907 16:58:20.048593  157111 portforward.go:525] "Error copying from local connection to remote stream" err="writeto tcp4 127.0.0.1:8000->127.0.0.1:47156: read tcp4 127.0.0.1:8000->127.0.0.1:47156: read: connection reset by peer" localPort=8000 remotePort=5000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
Handling connection for 8000
^Cbala@bala-MacBookPro:~/BeatNect/frame_v2/k8s$ kubectl port-forward svc/frame-v2 80:8080

