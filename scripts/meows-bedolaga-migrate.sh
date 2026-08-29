#!/usr/bin/env bash
# Meows ← Bedolaga: интерактивная миграция клиентов/тарифов (Linux + Docker).
#
# Запуск из клона репозитория:
#   ./scripts/meows-bedolaga-migrate.sh
#
# Под капотом: go run ./tools/migrate-bedolaga (или готовый бинарь MEOWS_MIGRATE_BIN).
#
set -euo pipefail

SCRIPT_VERSION="1.1.0"
TEMP_PG_NAME="${MEOWS_BEDOLAGA_PG_NAME:-meows-bedolaga-restore}"
TEMP_PG_PORT="${MEOWS_BEDOLAGA_PG_PORT:-5433}"
TEMP_PG_PASS="${MEOWS_BEDOLAGA_PG_PASS:-migrator}"
TEMP_PG_DB="${MEOWS_BEDOLAGA_PG_DB:-bedolaga_restore}"

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[1;31m'
  C_CYAN=$'\033[1;36m'
  C_GRAY=$'\033[90m'
else
  C_RESET= C_GREEN= C_YELLOW= C_RED= C_CYAN= C_GRAY=
fi

prompt_prefix() {
  printf '%s[%s%s?%s%s]%s %s%s%s' \
    "${C_GRAY}" "${C_RESET}" "${C_CYAN}" "${C_RESET}" "${C_GRAY}" "${C_RESET}" \
    "${C_YELLOW}" "$1" "${C_RESET}"
}
log()  { printf '%s\n' "$*"; }
menu() { printf '%s%s%s\n' "${C_YELLOW}" "$*" "${C_RESET}"; }
meta() { printf '%s%s%s\n' "${C_GRAY}" "$*" "${C_RESET}"; }
info() { printf '%s%s%s\n' "${C_CYAN}" "$*" "${C_RESET}"; }
ok()   { printf '%s%s%s\n' "${C_GREEN}" "✓ $*" "${C_RESET}"; }
warn() { printf '%s%s%s\n' "${C_YELLOW}" "! $*" "${C_RESET}"; }
err()  { printf '%s%s%s\n' "${C_RED}" "✗ $*" "${C_RESET}" >&2; }
die()  { err "$*"; exit 1; }

header() {
  printf '\n%s%s%s\n' "${C_CYAN}" "$*" "${C_RESET}"
  printf '%s%s%s\n\n' "${C_GRAY}" "────────────────────────────────────────" "${C_RESET}"
}

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Нужна команда: $1"; }

ask() {
  local __var="$1" __prompt="$2" __default="${3-}" __reply="" __pfx
  __pfx="$(prompt_prefix "${__prompt}:")"
  if [[ -n "$__default" ]]; then
    if [[ -t 0 ]]; then read -e -i "$__default" -r -p "${__pfx} " __reply || true
    else read -r -p "${__pfx} " __reply || true; fi
    __reply="${__reply:-$__default}"
  else
    if [[ -t 0 ]]; then read -e -r -p "${__pfx} " __reply || true
    else read -r -p "${__pfx} " __reply || true; fi
  fi
  printf -v "$__var" '%s' "${__reply-}"
}

ask_yn() {
  local __var="$1" __prompt="$2" __def="${3:-N}" __reply="" __hint __pfx
  if [[ "$__def" =~ ^[Yy]$ ]]; then __hint="Y/n"; else __hint="y/N"; fi
  __pfx="$(prompt_prefix "${__prompt} (${__hint}):")"
  if [[ -t 0 ]]; then read -e -r -p "${__pfx} " __reply || true
  else read -r -p "${__pfx} " __reply || true; fi
  __reply="${__reply:-$__def}"
  case "$__reply" in
    [Yy]|[Yy][Ee][Ss]) printf -v "$__var" 'y' ;;
    *) printf -v "$__var" 'n' ;;
  esac
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

CONFIG_PATH="${MEOWS_MIGRATE_CONFIG:-${REPO_ROOT}/migrate.yaml}"
REPORT_DIR="${MEOWS_MIGRATE_OUT:-${REPO_ROOT}/migrate-out}"
SOURCE_DSN=""
TARGET_DSN=""
RW_URL=""
RW_TOKEN=""
RW_MODE="local"

load_env_defaults() {
  local envf="${REPO_ROOT}/.env"
  [[ -f "$envf" ]] || return 0
  # shellcheck disable=SC1090
  set -a; source "$envf" 2>/dev/null || true; set +a
  TARGET_DSN="${DATABASE_URL:-}"
  RW_URL="${REMNAWAVE_URL:-${REMNAWAVE_BASE_URL:-}}"
  RW_TOKEN="${REMNAWAVE_TOKEN:-${REMNAWAVE_API_TOKEN:-}}"
  RW_MODE="${REMNAWAVE_MODE:-local}"
}

yaml_quote() {
  # Quote scalar for YAML so passwords with #/: don't break parsing.
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '"%s"' "$s"
}

write_config() {
  cat >"$CONFIG_PATH" <<EOF
source:
  database_url: $(yaml_quote "${SOURCE_DSN}")
target:
  database_url: $(yaml_quote "${TARGET_DSN}")
remnawave:
  base_url: $(yaml_quote "${RW_URL}")
  token: $(yaml_quote "${RW_TOKEN}")
  mode: $(yaml_quote "${RW_MODE}")
tariffs:
  mode: import_from_bedolaga
  mapping: {}
balance:
  enabled: true
  policy: user_mapped_tariff
  fallback_policy: cheapest_imported_1m
  apply_to_remnawave: true
customers:
  on_conflict: prefer_bedolaga
  set_legal_accepted: true
  skip_deleted: true
  skip_blocked: true
  import_cabinet: true
referrals:
  import_graph: true
reporting:
  dir: ${REPORT_DIR}
EOF
  ok "Конфиг записан: ${CONFIG_PATH}"
}

run_engine() {
  local mode="$1" step="$2"
  local args=(-config "$CONFIG_PATH" -step "$step")
  if [[ "$mode" == "apply" ]]; then
    args+=(-apply)
  else
    args+=(-dry-run)
  fi
  if [[ -n "${MEOWS_MIGRATE_BIN:-}" ]]; then
    need_cmd "$(basename "$MEOWS_MIGRATE_BIN")"
    "$MEOWS_MIGRATE_BIN" "${args[@]}"
  else
    need_cmd go
    go run ./tools/migrate-bedolaga "${args[@]}"
  fi
}

ensure_temp_pg() {
  need_cmd docker
  if docker ps -a --format '{{.Names}}' | grep -qx "$TEMP_PG_NAME"; then
    info "Контейнер ${TEMP_PG_NAME} уже есть — стартуем"
    docker start "$TEMP_PG_NAME" >/dev/null || true
  else
    info "Поднимаю temp Postgres ${TEMP_PG_NAME} на порту ${TEMP_PG_PORT}"
    docker run -d --name "$TEMP_PG_NAME" \
      -e POSTGRES_PASSWORD="$TEMP_PG_PASS" \
      -e POSTGRES_DB="$TEMP_PG_DB" \
      -p "${TEMP_PG_PORT}:5432" \
      postgres:16 >/dev/null
  fi
  info "Жду готовности Postgres..."
  local i
  for i in $(seq 1 30); do
    if docker exec "$TEMP_PG_NAME" pg_isready -U postgres >/dev/null 2>&1; then
      ok "Postgres готов"
      SOURCE_DSN="postgres://postgres:${TEMP_PG_PASS}@127.0.0.1:${TEMP_PG_PORT}/${TEMP_PG_DB}?sslmode=disable"
      return 0
    fi
    sleep 1
  done
  die "Postgres не поднялся за 30с"
}

restore_dump() {
  local dump_path="$1"
  [[ -f "$dump_path" ]] || die "Файл не найден: $dump_path"
  ensure_temp_pg
  info "Восстанавливаю дамп (может занять время)..."
  case "$dump_path" in
    *.gz)
      gunzip -c "$dump_path" | docker exec -i "$TEMP_PG_NAME" psql -U postgres -d "$TEMP_PG_DB" >/dev/null
      ;;
    *.sql)
      docker exec -i "$TEMP_PG_NAME" psql -U postgres -d "$TEMP_PG_DB" <"$dump_path" >/dev/null
      ;;
    *.dump|*.backup)
      need_cmd pg_restore || true
      docker exec -i "$TEMP_PG_NAME" pg_restore -U postgres -d "$TEMP_PG_DB" --no-owner --role=postgres <"$dump_path" \
        || warn "pg_restore вернул предупреждения (часто нормально)"
      ;;
    *)
      die "Неизвестный формат дампа (ожидаются .sql / .sql.gz / .dump)"
      ;;
  esac
  ok "Дамп восстановлен в ${TEMP_PG_NAME}"
}

cleanup_temp_pg() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$TEMP_PG_NAME"; then
    ask_yn ans "Удалить temp контейнер ${TEMP_PG_NAME}?" N
    if [[ "$ans" == "y" ]]; then
      docker rm -f "$TEMP_PG_NAME" >/dev/null
      ok "Контейнер удалён"
    fi
  else
    meta "Temp Postgres не найден"
  fi
}

show_report_hint() {
  meta "Отчёты: ${REPORT_DIR}/"
  meta "  summary.json  customers.csv  tariffs.csv  balances.csv  problems.csv"
  if [[ -f "${REPORT_DIR}/summary.json" ]]; then
    info "summary:"
    cat "${REPORT_DIR}/summary.json" || true
  fi
}

prepare_source() {
  header "Источник данных Bedolaga"
  menu "1) Путь к pg_dump (.sql / .sql.gz) — подниму temp Postgres и восстановлю"
  menu "2) Уже есть DSN к Postgres со схемой Bedolaga"
  menu "3) Bedolaga admin-бекап уже восстановлен — укажу DSN"
  ask choice "Выбор" "1"
  case "$choice" in
    1)
      ask dump "Путь к дампу" ""
      restore_dump "$dump"
      ;;
    2|3)
      ask SOURCE_DSN "Bedolaga DATABASE_URL" "${SOURCE_DSN:-postgres://postgres:migrator@127.0.0.1:5433/bedolaga_restore?sslmode=disable}"
      ;;
    *) die "Неверный выбор" ;;
  esac
  [[ -n "$SOURCE_DSN" ]] || die "SOURCE_DSN пуст"

  header "Целевая БД нашего бота + Remnawave"
  compat_confirm
  ask TARGET_DSN "Наш DATABASE_URL" "${TARGET_DSN}"
  ask RW_URL "Remnawave URL (3.3.*-3.4.*)" "${RW_URL}"
  ask RW_TOKEN "Remnawave API token" "${RW_TOKEN}"
  ask RW_MODE "Remnawave mode (local/remote)" "${RW_MODE}"
  ask REPORT_DIR "Папка отчётов" "${REPORT_DIR}"
  ask CONFIG_PATH "Путь migrate.yaml" "${CONFIG_PATH}"
  write_config
}

print_banner() {
  header "Meows ← Bedolaga migrate  v${SCRIPT_VERSION}"
  meta "Repo: ${REPO_ROOT}"
  meta "Цель: Meows + Remnawave 3.3.*-3.4.* (см. documentation/compatibility.md)"
  warn "Bedolaga 4.0+ = панель Remnawave 3.0+ — обычный кейс same-panel, если это 3.3.*-3.4.*"
  warn "Bedolaga 3.x (напр. 3.60) = панель Remnawave 2.x — данные в нашу БД перенесём,"
  warn "но саму панель 2.x бот 5.x не поддерживает: Meows нужно подключать к RW 3.3.*-3.4.*"
  meta "Версия Bedolaga сама по себе не важна — важна корректность данных и панель 3.3.*-3.4.*"
  meta "Same-panel: только чтение + опциональный extend expire; сквады не трогаем"
}

compat_confirm() {
  header "Совместимость Remnawave"
  info "Укажите URL/token панели Remnawave 3.3.*-3.4.*, с которой работает Meows."
  info "Источник Bedolaga может быть 3.60 или 4.x — движок подстраивается под схему."
  ask_yn ans "Панель Remnawave для Meows — ветка 3.3.* или 3.4.* (не 2.8)?" Y
  if [[ "$ans" != "y" ]]; then
    warn "Бот 5.x умеет только Remnawave 3.x: в 3.0.0 у пользователя панели удалён uuid"
    warn "и убран GET /api/users/by-telegram-id/{id} — на панели 2.8 движок не найдёт клиентов."
    ask_yn ans2 "Всё равно продолжить настройку?" N
    [[ "$ans2" == "y" ]] || die "Остановлено: под Meows 5.x нужна панель Remnawave 3.3.*-3.4.*"
  fi
}

main_menu() {
  while true; do
    header "Меню"
    menu "1) Подготовить источник + записать migrate.yaml"
    menu "2) Dry-run (все шаги, без записи)"
    menu "3) Apply: тарифы"
    menu "4) Apply: клиенты (TG + cabinet)"
    menu "5) Apply: сроки/баланс (RW extend при необходимости)"
    menu "6) Apply: рефералы"
    menu "7) Показать отчёты"
    menu "8) Cleanup temp Postgres"
    menu "0) Выход"
    ask choice "Пункт" "1"
    case "$choice" in
      1) prepare_source ;;
      2)
        [[ -f "$CONFIG_PATH" ]] || die "Сначала пункт 1 (нет ${CONFIG_PATH})"
        run_engine dry-run all
        show_report_hint
        ;;
      3)
        [[ -f "$CONFIG_PATH" ]] || die "Сначала пункт 1"
        ask_yn ans "Применить импорт тарифов?" N
        [[ "$ans" == "y" ]] || continue
        run_engine apply tariffs
        show_report_hint
        ;;
      4)
        [[ -f "$CONFIG_PATH" ]] || die "Сначала пункт 1"
        ask_yn ans "Применить импорт клиентов?" N
        [[ "$ans" == "y" ]] || continue
        run_engine apply customers
        show_report_hint
        ;;
      5)
        [[ -f "$CONFIG_PATH" ]] || die "Сначала пункт 1"
        warn "Этот шаг может УДЛИНИТЬ expireAt в Remnawave (сквады не трогает)."
        ask_yn ans "Применить balance/RW extend?" N
        [[ "$ans" == "y" ]] || continue
        run_engine apply balance
        show_report_hint
        ;;
      6)
        [[ -f "$CONFIG_PATH" ]] || die "Сначала пункт 1"
        ask_yn ans "Применить реферальный граф?" N
        [[ "$ans" == "y" ]] || continue
        run_engine apply referrals
        show_report_hint
        ;;
      7) show_report_hint ;;
      8) cleanup_temp_pg ;;
      0) exit 0 ;;
      *) warn "Неизвестный пункт" ;;
    esac
  done
}

print_banner
load_env_defaults
main_menu
