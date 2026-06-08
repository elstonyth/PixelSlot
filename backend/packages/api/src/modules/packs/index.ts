import { Module } from "@medusajs/framework/utils";
import PacksModuleService from "./service";

export const PACKS_MODULE = "packs";

export default Module(PACKS_MODULE, {
  service: PacksModuleService,
});
