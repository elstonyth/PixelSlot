import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Container,
  Heading,
  Text,
  Table,
  Button,
  Switch,
  Input,
  StatusBadge,
  Badge,
  toast,
  clx,
} from "@medusajs/ui";
import { ArrowLeft } from "@medusajs/icons";
import { packsApi } from "../../../lib/packs-api";
import { computeOdds, type OddsInput } from "../../../lib/odds-math";

// One editable row: the immutable card facts + its current saved %, plus the
// editable lock state and (when locked) the win-rate input as a string so the
// operator can type freely (e.g. "12.").
type EditRow = {
  card_id: string;
  name: string;
  image: string;
  rarity: string;
  market_value: number;
  currentPct: number;
  locked: boolean;
  pctInput: string;
};

const fmtPct = (n: number): string =>
  `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

const PackOddsEditorPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug = "" } = useParams();

  const [packTitle, setPackTitle] = useState<string>("");
  const [packStatus, setPackStatus] = useState<string>("");
  const [rows, setRows] = useState<EditRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    packsApi.admin.packs.$slug.odds
      .query({ $slug: slug })
      .then((res) => {
        if (!active) return;
        setPackTitle(res.pack.title);
        setPackStatus(res.pack.status);
        setRows(
          res.odds.map((o) => ({
            card_id: o.card_id,
            name: o.name,
            image: o.image,
            rarity: o.rarity,
            market_value: o.market_value,
            currentPct: o.pct,
            locked: o.locked,
            pctInput: String(o.pct),
          })),
        );
      })
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [slug]);

  // Live preview — the SAME even-split math the save workflow runs, so what the
  // operator sees in "After save" is exactly what gets persisted.
  const { result, previewByCard } = useMemo(() => {
    const inputs: OddsInput[] = (rows ?? []).map((r) => ({
      card_id: r.card_id,
      locked: r.locked,
      pct: Number(r.pctInput),
    }));
    const result = computeOdds(inputs);
    const previewByCard = new Map(result.computed.map((c) => [c.card_id, c.pct]));
    return { result, previewByCard };
  }, [rows]);

  const setRow = (cardId: string, patch: Partial<EditRow>) =>
    setRows(
      (prev) =>
        prev?.map((r) => (r.card_id === cardId ? { ...r, ...patch } : r)) ?? null,
    );

  // Locking captures the card's CURRENT real % so the operator can pin a card to
  // preserve it (rather than letting the even-split flatten it).
  const toggleLock = (r: EditRow) =>
    setRow(r.card_id, {
      locked: !r.locked,
      pctInput: !r.locked ? String(r.currentPct) : r.pctInput,
    });

  const newTotalPct = useMemo(
    () => result.computed.reduce((s, c) => s + c.pct, 0),
    [result],
  );
  const noneLocked = !!rows && rows.length > 0 && rows.every((r) => !r.locked);
  const evenPct = rows && rows.length ? 100 / rows.length : 0;

  async function save() {
    if (!rows || result.error || saving) return;
    setSaving(true);
    try {
      const entries: OddsInput[] = rows.map((r) => ({
        card_id: r.card_id,
        locked: r.locked,
        pct: Number(r.pctInput),
      }));
      const res = await packsApi.admin.packs.$slug.odds.mutate({ $slug: slug, entries });
      const byId = new Map(res.odds.map((c) => [c.card_id, c]));
      setRows(
        (prev) =>
          prev?.map((r) => {
            const c = byId.get(r.card_id);
            return c
              ? { ...r, currentPct: c.pct, locked: c.locked, pctInput: String(c.pct) }
              : r;
          }) ?? null,
      );
      toast.success(t("packs.editor.saved"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">{t("packs.editor.loadError")}</Text>
      </Container>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/packs")}
            className="text-ui-fg-subtle hover:text-ui-fg-base mb-2 flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("packs.editor.back")}
          </button>
          <div className="flex items-center gap-2">
            <Heading level="h2">{packTitle || slug}</Heading>
            {packStatus && (
              <StatusBadge color={packStatus === "active" ? "green" : "grey"}>
                {packStatus}
              </StatusBadge>
            )}
          </div>
          <Text className="text-ui-fg-subtle mt-1 max-w-2xl" size="small">
            {t("packs.editor.subtitle")}
          </Text>
        </div>
      </div>

      {rows === null ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">…</Text>
        </div>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("packs.editor.card")}</Table.HeaderCell>
                <Table.HeaderCell>{t("packs.editor.rarity")}</Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  {t("packs.editor.value")}
                </Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  {t("packs.editor.current")}
                </Table.HeaderCell>
                <Table.HeaderCell className="text-center">
                  {t("packs.editor.lock")}
                </Table.HeaderCell>
                <Table.HeaderCell>{t("packs.editor.winRate")}</Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  {t("packs.editor.result")}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => {
                const preview = previewByCard.get(r.card_id) ?? 0;
                const changed = Math.abs(preview - r.currentPct) >= 0.005;
                return (
                  <Table.Row key={r.card_id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <img
                          src={r.image}
                          alt=""
                          className="h-10 w-8 shrink-0 rounded object-contain"
                        />
                        <span className="max-w-[18rem] truncate">{r.name}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall">{r.rarity}</Badge>
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle text-right tabular-nums">
                      ${r.market_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle text-right tabular-nums">
                      {fmtPct(r.currentPct)}
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <Switch
                        checked={r.locked}
                        onCheckedChange={() => toggleLock(r)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        disabled={!r.locked}
                        value={r.locked ? r.pctInput : ""}
                        placeholder={r.locked ? "" : "auto"}
                        onChange={(e) => setRow(r.card_id, { pctInput: e.target.value })}
                        className="w-24 tabular-nums"
                      />
                    </Table.Cell>
                    <Table.Cell
                      className={clx(
                        "text-right tabular-nums",
                        changed ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle",
                      )}
                    >
                      {fmtPct(preview)}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>

          <div className="flex flex-col gap-3 px-6 py-4">
            {noneLocked && (
              <Text size="small" className="text-ui-tag-orange-text">
                {t("packs.editor.flattenWarning", { pct: evenPct.toFixed(2) })}
              </Text>
            )}
            {result.error && (
              <Text size="small" className="text-ui-tag-red-text">
                {result.error}
              </Text>
            )}
            <div className="flex items-center justify-between">
              <div className="text-ui-fg-subtle flex gap-6 text-sm tabular-nums">
                <span>
                  {t("packs.editor.lockedTotal")}:{" "}
                  <span className="text-ui-fg-base">{fmtPct(result.lockedTotalPct)}</span>
                </span>
                <span>
                  {t("packs.editor.newTotal")}:{" "}
                  <span className="text-ui-fg-base">{fmtPct(newTotalPct)}</span>
                </span>
              </div>
              <Button
                variant="primary"
                onClick={save}
                isLoading={saving}
                disabled={saving || result.error !== null}
              >
                {saving ? t("packs.editor.saving") : t("packs.editor.save")}
              </Button>
            </div>
          </div>
        </>
      )}
    </Container>
  );
};

export default PackOddsEditorPage;
