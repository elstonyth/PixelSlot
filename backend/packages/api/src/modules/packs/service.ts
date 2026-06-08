import { MedusaService } from "@medusajs/framework/utils";
import Pack from "./models/pack";

// Auto-generates CRUD for Pack: listPacks / retrievePack / createPacks /
// updatePacks / deletePacks. Phase 5 extends this service with the gacha
// models (PackOdds, Card, Pull) by adding them to the MedusaService factory.
class PacksModuleService extends MedusaService({
  Pack,
}) {}

export default PacksModuleService;
