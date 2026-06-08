import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { savePackOddsStep, type SavePackOddsInput } from "./steps/save-pack-odds";

// save-pack-odds — the admin win-rate editor's save process.
//
//   validate + even-split + persist (compensated)
//
// A single mutating step today; the compensation (restore the prior odds
// snapshot) is in place so an audit/event step can be appended later without
// risking a half-applied save. The composition body stays pure — all logic
// (validation, the even-split math, the DB read/write) lives inside the step.
export const savePackOddsWorkflow = createWorkflow(
  "save-pack-odds",
  function (input: SavePackOddsInput) {
    const computed = savePackOddsStep(input);
    return new WorkflowResponse(computed);
  }
);

export default savePackOddsWorkflow;
