# migrate-bedolaga

Go-движок миграции Bedolaga → этот shop. Для админов предпочтителен wizard:

```bash
./scripts/meows-bedolaga-migrate.sh
```

Документация: [`documentation/bedolaga-migration.md`](../../documentation/bedolaga-migration.md).

```bash
go run ./tools/migrate-bedolaga -write-example-config
go run ./tools/migrate-bedolaga -config migrate.yaml -dry-run -step all
go run ./tools/migrate-bedolaga -config migrate.yaml -apply -step tariffs
```

Тесты формулы срока:

```bash
go test ./tools/migrate-bedolaga/ -count=1
```
