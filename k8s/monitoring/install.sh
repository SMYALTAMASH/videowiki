echo "Installing Prometheus"
helm install stable/prometheus --name prometheus --version 11.12.0 --values prometheus-11.12.0.values --namespace monitoring 
echo "Installed successfully"
echo "Installing Grafana"
helm install stable/grafana --name grafana --version 5.5.5 --values grafana-5.5.5.values --namespace monitoring 
echo "Installed successfully"
