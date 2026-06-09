import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updatePackStep, type UpdatePackInput } from "./steps/update-pack";

// update-pack — patch a pack's listing fields (slug is immutable).
export const updatePackWorkflow = createWorkflow(
  "update-pack",
  function (input: UpdatePackInput) {
    const result = updatePackStep(input);
    return new WorkflowResponse(result);
  }
);

export default updatePackWorkflow;
