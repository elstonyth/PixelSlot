import { MedusaService } from "@medusajs/framework/utils";
import Pack from "./models/pack";
import Card from "./models/card";
import PackOdds from "./models/pack-odds";
import Pull from "./models/pull";

// Auto-generates CRUD for each model: list/retrieve/create/update/delete<Model>s
// (e.g. listPacks, listCards, listPackOdds, createPulls). Phase 5a adds the gacha
// models — Card (prize metadata), PackOdds (the weighted table) and Pull (the
// result ledger, written by the open-pack workflow in 5b).
class PacksModuleService extends MedusaService({
  Pack,
  Card,
  PackOdds,
  Pull,
}) {}

export default PacksModuleService;
