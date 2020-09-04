echo "===================== Deploying metrics server ====================="
kubectl apply -f metrics-server.yml
sleep 1
echo "===================== Deploying APP ====================="
kubectl apply -f deployments.yml