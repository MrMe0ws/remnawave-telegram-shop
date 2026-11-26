import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, Sparkle, Undo2 } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminCheckbox } from "../components/AdminCheckbox";
import type { HostInbound } from "./hostForm";
import { NodeSidePanel } from "./NodeSidePanel";
import { PANEL_CAP, PanelError } from "./panelUi";

/**
 * Панель выбора инбаунда хоста («Профили» как в Remna). Хост привязан ровно к одному инбаунду,
 * поэтому выбор другого снимает прежний. «Применить» только кладёт выбор в черновик формы хоста.
 */
export function HostInboundPicker({
  open,
  onClose,
  hostName,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  hostName: string;
  /** Текущий инбаунд черновика хоста. */
  value: HostInbound;
  onApply: (v: HostInbound) => void;
}) {
  const { t } = useTranslation();
  const profilesQ = useQuery({
    queryKey: ["admin-config-profiles"],
    queryFn: () => api.adminConfigProfiles(),
    enabled: open,
    staleTime: 30_000,
  });
  const profiles = profilesQ.data?.profiles ?? [];

  const [sel, setSel] = useState<{ profile: string; uuid: string }>({
    profile: value.profile,
    uuid: value.uuid,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // При каждом открытии начинаем с текущего инбаунда хоста.
  useEffect(() => {
    if (!open) return;
    setSel({ profile: value.profile, uuid: value.uuid });
    setExpanded(new Set(value.profile ? [value.profile] : []));
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const found = profiles.find((p) => p.uuid === sel.profile);
  const foundIb = found?.inbounds.find((i) => i.uuid === sel.uuid);
  const selName = foundIb
    ? found!.name
    : sel.uuid === value.uuid
      ? value.profileName
      : "";
  const selTag = foundIb
    ? foundIb.tag
    : sel.uuid === value.uuid
      ? value.tag
      : "";

  const changed = sel.uuid !== value.uuid || sel.profile !== value.profile;
  const toggle = (profile: string, uuid: string) =>
    setSel((s) =>
      s.uuid === uuid && s.profile === profile
        ? { profile: "", uuid: "" }
        : { profile, uuid },
    );
  const toggleOpen = (uuid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });

  const apply = () => {
    if (!sel.uuid || !sel.profile) return;
    onApply({
      profile: sel.profile,
      uuid: sel.uuid,
      profileName: selName,
      tag: selTag,
    });
    onClose();
  };

  const needle = query.trim().toLowerCase();
  const view = profiles
    .map((p) => {
      const nameHit = needle !== "" && p.name.toLowerCase().includes(needle);
      const inbounds =
        needle === "" || nameHit
          ? p.inbounds
          : p.inbounds.filter((i) =>
              `${i.tag} ${i.type} ${i.port}`.toLowerCase().includes(needle),
            );
      return {
        p,
        inbounds,
        hit: needle === "" || nameHit || inbounds.length > 0,
      };
    })
    .filter((x) => x.hit);

  const act =
    "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-40";

  return (
    <NodeSidePanel
      open={open}
      onClose={onClose}
      depth={3}
      icon={Sparkle}
      iconAccent="emerald"
      title={t("admin.nodes.panels.picker.title")}
    >
      <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{hostName || "—"}</div>
          <div className="mt-0.5 truncate font-mono text-xs text-violet-700 dark:text-violet-300">
            {sel.uuid
              ? `${selName || "—"} › ${selTag || "—"}`
              : t("admin.nodes.panels.picker.none")}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSel({ profile: value.profile, uuid: value.uuid })}
            disabled={!changed}
            title={t("admin.nodes.panels.picker.reset")}
            aria-label={t("admin.nodes.panels.picker.reset")}
            className={cn(
              act,
              "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400",
            )}
          >
            <Undo2 className="size-4" aria-hidden />
            <span>{t("admin.nodes.panels.picker.reset")}</span>
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!changed || !sel.uuid}
            title={t("admin.nodes.panels.picker.apply")}
            aria-label={t("admin.nodes.panels.picker.apply")}
            className={cn(
              act,
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
            )}
          >
            <Check className="size-4" aria-hidden />
            <span>{t("admin.nodes.panels.picker.apply")}</span>
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.nodes.edit.profiles.search")}
          aria-label={t("admin.nodes.edit.profiles.search")}
          className="h-10 w-full rounded-lg border border-input bg-card dark:bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-input"
        />
      </div>

      {profilesQ.isLoading && (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      )}
      {profilesQ.isError && (
        <PanelError
          onRetry={() => void profilesQ.refetch()}
          message={t("admin.nodes.edit.profiles.loadError")}
        />
      )}
      {!profilesQ.isLoading && !profilesQ.isError && view.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("admin.nodes.edit.profiles.empty")}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {view.map(({ p, inbounds }) => {
          const isOpen = needle !== "" || expanded.has(p.uuid);
          const chosen =
            p.uuid === sel.profile &&
            p.inbounds.some((i) => i.uuid === sel.uuid)
              ? 1
              : 0;
          const active = chosen > 0;
          return (
            <div
              key={p.uuid}
              className={cn(
                "overflow-hidden rounded-xl border bg-muted/30",
                active ? "border-emerald-500/40" : "border-border/70",
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleOpen(p.uuid)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      !isOpen && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">
                    {p.name}
                  </span>
                </button>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold",
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border bg-background/60 text-muted-foreground",
                  )}
                  title={t("admin.nodes.edit.profiles.chosenOf")}
                >
                  {chosen}/{p.inbounds.length}
                </span>
              </div>
              {isOpen && (
                <div className="admin-expand border-t border-border/60 px-3 pb-3 pt-2">
                  <div className={cn(PANEL_CAP, "mb-1")}>
                    {t("admin.nodes.panels.picker.inbounds")}
                  </div>
                  {inbounds.length === 0 ? (
                    <div className="py-2 text-xs text-muted-foreground">
                      {t("admin.nodes.edit.profiles.noInbounds")}
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {inbounds.map((i) => {
                        const on =
                          p.uuid === sel.profile && i.uuid === sel.uuid;
                        return (
                          <li key={i.uuid}>
                            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/40">
                              <AdminCheckbox
                                checked={on}
                                onChange={() => toggle(p.uuid, i.uuid)}
                                aria-label={i.tag}
                              />
                              <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold">
                                {i.tag}
                              </span>
                              <span className="shrink-0 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">
                                {i.type}
                              </span>
                              {i.port > 0 && (
                                <span className="shrink-0 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                  {i.port}
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </NodeSidePanel>
  );
}
