import { getScenarios } from "~/server/config/businessScenarios";

export default defineEventHandler(() => {
  return getScenarios();
});
