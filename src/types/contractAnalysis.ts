export type ProblemSeverityPl = "mała" | "średnia" | "duża";

export type ProblemType =
  | "brak_regulacji"
  | "niejasne"
  | "niekorzystne";

export type ContractModule =
  | "CIVIL_LAW"
  | "COMPANY_LAW"
  | "DATA_PROTECTION"
  | "TAX"
  | "SERVICE_LAW";

export type DecisionFlag = "MUST_CHANGE" | "NICE_TO_HAVE" | "ONLY_NOTE";

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ContractComment {
  keyword: string;
  module: ContractModule;
  question_id: number | null;
  severity_pl: ProblemSeverityPl;
  problem_type: ProblemType;
  decision_flag?: DecisionFlag;
  where_in_contract: string;
  current_text_summary: string;
  risk_description: string;
  risk_short?: string;
  suggested_change_summary: string;
  example_clause_pl: string;
}

export interface ContractSummary {
  overall_risk_level: RiskLevel;
  top_actions: string[];
  recommended_strategy: string;
}

export interface ContractTermEntry {
  keyword: string;
  what_is_agreed: string;
  where_in_contract: string;
  what_i_must_do: string;
  if_done: string;
  if_not_done: string;
}

export interface ContractAnalysisResult {
  summary?: ContractSummary;
  comments: ContractComment[];
  terms: {
    current: ContractTermEntry[];
    after_comments: ContractTermEntry[];
  };
}

