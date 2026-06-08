export const BUSINESS_PLAN_VIEW_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "MESA"];
export const BUSINESS_PLAN_GENERATE_ROLES = ["ADMIN", "GESTAO"];

export function canViewBusinessPlan(role: string | null | undefined): boolean {
  return !!role && BUSINESS_PLAN_VIEW_ROLES.includes(role);
}

export function canGenerateBusinessPlan(role: string | null | undefined): boolean {
  return !!role && BUSINESS_PLAN_GENERATE_ROLES.includes(role);
}
