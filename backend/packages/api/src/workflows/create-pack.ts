import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createPackStep, type PackWriteInput } from "./steps/create-pack";

// create-pack — create a gacha Pack listing (empty prize pool until members are
// assigned).
export const createPackWorkflow = createWorkflow(
  "create-pack",
  function (input: PackWriteInput) {
    const result = createPackStep(input);
    return new WorkflowResponse(result);
  }
);

export default createPackWorkflow;
