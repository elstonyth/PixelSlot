import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Container, Heading, Text, Table, Button, StatusBadge } from "@medusajs/ui";
import { Gift } from "@medusajs/icons";
import type { RouteConfig } from "@mercurjs/dashboard-sdk";
import { packsApi, type AdminPack } from "../../lib/packs-api";

// Sidebar entry. The label is literal (internal single-operator tool); switch to
// RouteConfig.translationNs if this dashboard is ever localized.
export const config: RouteConfig = {
  label: "Gacha Packs",
  icon: Gift,
};

const PacksListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<AdminPack[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    packsApi.admin.packs
      .query()
      .then((res) => active && setPacks(res.packs))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t("packs.title")}</Heading>
        <Text className="text-ui-fg-subtle mt-1" size="small">
          {t("packs.subtitle")}
        </Text>
      </div>

      {error ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">{t("packs.list.loadError")}</Text>
        </div>
      ) : packs === null ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">…</Text>
        </div>
      ) : packs.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">{t("packs.list.empty")}</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("packs.list.pack")}</Table.HeaderCell>
              <Table.HeaderCell>{t("packs.list.category")}</Table.HeaderCell>
              <Table.HeaderCell>{t("packs.list.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("packs.list.price")}</Table.HeaderCell>
              <Table.HeaderCell className="text-right">
                {t("packs.list.action")}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {packs.map((p) => (
              <Table.Row
                key={p.slug}
                className="cursor-pointer"
                onClick={() => navigate(`/packs/${p.slug}`)}
              >
                <Table.Cell className="font-medium">{p.title}</Table.Cell>
                <Table.Cell className="text-ui-fg-subtle">{p.category}</Table.Cell>
                <Table.Cell>
                  <StatusBadge color={p.status === "active" ? "green" : "grey"}>
                    {p.status}
                  </StatusBadge>
                </Table.Cell>
                <Table.Cell className="tabular-nums">
                  ${p.price.toLocaleString("en-US")}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/packs/${p.slug}`);
                    }}
                  >
                    {t("packs.list.edit")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export default PacksListPage;
