#kubectl get svc frame-v2
#kubectl port-forward svc/frame-v2 8081:8080
#NAME       TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
#frame-v2   LoadBalancer   10.107.244.185   <pending>     8080:30080/TCP   24m
cloudflared tunnel --url localhost:8081
