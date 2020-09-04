echo "Adding elastic helm repo"
helm repo add elastic https://helm.elastic.co
echo "Updating helm repos"
helm repo update
echo "Installaing elastic search"
helm install elastic/elasticsearch --version 7.9.0 --name elasticsearch --values elasticsearch-7.9.0.values --namespace elk
echo "Installed successfully"
echo "Installing Kibana"
helm install elastic/kibana --version 7.9.0 --name kibana --values kibana-7.9.0.values --namespace elk
echo "Installed Successfully"
#echo "Installing Metricbeat"
#helm install elastic/metricbeat --version 7.9.0 --name metricbeat --values metricbeat-7.9.0.values --namespace elk
#echo "Installed successfully"
echo "Installing Filebeat"
helm install elastic/filebeat --version 7.9.0 --name filebeat --values filebeat-7.9.0.values --namespace elk
echo "Installed successfully"
