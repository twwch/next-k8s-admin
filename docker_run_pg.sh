docker run -d \
  --name k8s-admin-postgres-db \
  -e POSTGRES_USER=k8sadmin \
  -e POSTGRES_PASSWORD=k8sadmin \
  -e POSTGRES_DB=k8sadmin \
  -p 5433:5432 \
  -v /opt/midd/next-k8s-admin-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine