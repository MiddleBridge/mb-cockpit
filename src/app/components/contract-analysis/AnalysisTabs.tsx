"use client";

import { useState } from "react";
import type { ContractAnalysisResult, ContractComment, ContractTermEntry } from "../../../types/contractAnalysis";
import CommentCard from "./CommentCard";
import SeverityBadge from "./SeverityBadge";
import DecisionBadge from "./DecisionBadge";
import SeverityDot from "./SeverityDot";

type Tab = "summary" | "comments" | "current" | "after" | "comparison";

interface AnalysisTabsProps {
  analysisResult: ContractAnalysisResult;
  onTermClick?: (term: ContractTermEntry) => void;
}

function getRowHighlight(severity?: "duża" | "średnia" | "mała") {
  if (!severity) return "";
  if (severity === "duża") return "bg-red-950/30";
  if (severity === "średnia") return "bg-amber-950/20";
  return "bg-emerald-950/10";
}

export default function AnalysisTabs({
  analysisResult,
  onTermClick,
}: AnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterDecision, setFilterDecision] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string | null>(null);

  // Build keyword -> highest severity problem map
  const keywordToProblem = new Map<string, ContractComment>();
  analysisResult.comments.forEach((c) => {
    const existing = keywordToProblem.get(c.keyword);
    if (!existing) {
      keywordToProblem.set(c.keyword, c);
    } else {
      // Keep highest severity
      const severityOrder = { "duża": 3, "średnia": 2, "mała": 1 };
      if (severityOrder[c.severity_pl] > severityOrder[existing.severity_pl]) {
        keywordToProblem.set(c.keyword, c);
      }
    }
  });

  // Filter comments
  let filteredComments = analysisResult.comments;
  if (filterSeverity) {
    filteredComments = filteredComments.filter(
      (c) => c.severity_pl === filterSeverity
    );
  }
  if (filterDecision) {
    filteredComments = filteredComments.filter(
      (c) => c.decision_flag === filterDecision
    );
  }
  if (filterModule) {
    filteredComments = filteredComments.filter(
      (c) => c.module === filterModule
    );
  }

  // Sort comments by severity and decision flag
  const sortedComments = [...filteredComments].sort((a, b) => {
    const severityOrder = { "duża": 3, "średnia": 2, "mała": 1 };
    const decisionOrder = {
      MUST_CHANGE: 3,
      NICE_TO_HAVE: 2,
      ONLY_NOTE: 1,
    };

    const severityDiff =
      severityOrder[b.severity_pl] - severityOrder[a.severity_pl];
    if (severityDiff !== 0) return severityDiff;

    const aDecision = a.decision_flag ? decisionOrder[a.decision_flag] : 0;
    const bDecision = b.decision_flag ? decisionOrder[b.decision_flag] : 0;
    return bDecision - aDecision;
  });

  // Count by decision flag
  const mustChangeCount = analysisResult.comments.filter(
    (c) => c.decision_flag === "MUST_CHANGE"
  ).length;
  const niceToHaveCount = analysisResult.comments.filter(
    (c) => c.decision_flag === "NICE_TO_HAVE"
  ).length;
  const onlyNoteCount = analysisResult.comments.filter(
    (c) => c.decision_flag === "ONLY_NOTE"
  ).length;

  // Top 5 problems for summary
  const topProblems = sortedComments.slice(0, 5);

  const renderTermRow = (
    term: ContractTermEntry,
    isAfter: boolean = false
  ) => {
    const problem = keywordToProblem.get(term.keyword);
    const rowClassName = `border-b border-neutral-800 hover:bg-neutral-900/50 cursor-pointer transition-colors ${getRowHighlight(problem?.severity_pl)}`;

    return (
      <tr
        key={`${isAfter ? "after" : "current"}-${term.keyword}`}
        className={rowClassName}
        onClick={() => onTermClick?.(term)}
      >
        <td className="align-top py-2 px-2 text-xs font-medium text-neutral-100">
          <div className="flex items-center gap-1.5">
            {problem && <SeverityDot severity={problem.severity_pl} />}
            <span className="font-mono text-[10px]">{term.keyword}</span>
          </div>
        </td>
        <td className="align-top py-2 px-2 text-[11px] text-neutral-200 line-clamp-3">
          {term.what_is_agreed}
        </td>
        <td className="align-top py-2 px-2 text-[11px] text-neutral-200 line-clamp-3">
          {term.what_i_must_do}
        </td>
        <td className="align-top py-2 px-2 text-[11px] text-neutral-200 line-clamp-3">
          {term.if_not_done}
        </td>
        <td className="align-top py-2 px-2 text-[10px] text-neutral-500 text-right">
          {term.where_in_contract && (
            <span
              className="cursor-default underline decoration-dotted"
              title={term.where_in_contract}
            >
              where
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="border border-neutral-800 rounded-lg bg-neutral-900">
      {/* Tab navigation */}
      <div className="flex border-b border-neutral-800">
        {[
          { id: "summary" as Tab, label: "Summary" },
          { id: "comments" as Tab, label: "Comments" },
          { id: "current" as Tab, label: "Current terms" },
          { id: "after" as Tab, label: "After changes" },
          { id: "comparison" as Tab, label: "Before/After Comparison" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-neutral-800 text-white border-b-2 border-blue-500"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "summary" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left: Top 5 problems */}
            <div className="md:col-span-2">
              <h4 className="text-xs font-semibold text-white mb-2">
                Top 5 problems
              </h4>
              <div className="space-y-2 max-h-[540px] overflow-y-auto">
                {topProblems.map((c, idx) => (
                  <div
                    key={`${c.keyword}-${idx}`}
                    className="flex items-center gap-2 p-2 rounded border border-neutral-800 bg-neutral-950/60"
                  >
                    <SeverityBadge severity={c.severity_pl} />
                    <span className="text-[10px] font-mono text-neutral-300">
                      {c.keyword}
                    </span>
                    <span className="text-[11px] text-neutral-200 flex-1 truncate">
                      – {c.risk_short || c.risk_description.substring(0, 60)}
                      ...
                    </span>
                    {c.decision_flag && (
                      <DecisionBadge flag={c.decision_flag} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Stats */}
            <div>
              <h4 className="text-xs font-semibold text-white mb-2">Stats</h4>
              <div className="space-y-2">
                <div className="p-2 rounded border border-red-800/50 bg-red-950/20">
                  <div className="text-xs font-medium text-red-200">
                    {mustChangeCount}
                  </div>
                  <div className="text-[10px] text-red-300">MUST_CHANGE</div>
                </div>
                <div className="p-2 rounded border border-sky-800/50 bg-sky-950/20">
                  <div className="text-xs font-medium text-sky-200">
                    {niceToHaveCount}
                  </div>
                  <div className="text-[10px] text-sky-300">NICE_TO_HAVE</div>
                </div>
                <div className="p-2 rounded border border-neutral-800 bg-neutral-950/60">
                  <div className="text-xs font-medium text-neutral-200">
                    {onlyNoteCount}
                  </div>
                  <div className="text-[10px] text-neutral-400">ONLY_NOTE</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "comments" && (
          <div>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-neutral-400">Filter by:</span>
              
              {/* Severity filter */}
              <div className="flex gap-1">
                {(["duża", "średnia", "mała"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() =>
                      setFilterSeverity(
                        filterSeverity === sev ? null : sev
                      )
                    }
                    className={`px-2 py-0.5 text-[10px] rounded border ${
                      filterSeverity === sev
                        ? "bg-neutral-700 text-white border-neutral-600"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Decision filter */}
              <div className="flex gap-1">
                {(["MUST_CHANGE", "NICE_TO_HAVE", "ONLY_NOTE"] as const).map(
                  (flag) => (
                    <button
                      key={flag}
                      onClick={() =>
                        setFilterDecision(
                          filterDecision === flag ? null : flag
                        )
                      }
                      className={`px-2 py-0.5 text-[10px] rounded border ${
                        filterDecision === flag
                          ? "bg-neutral-700 text-white border-neutral-600"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700"
                      }`}
                    >
                      {flag === "MUST_CHANGE"
                        ? "Must"
                        : flag === "NICE_TO_HAVE"
                        ? "Nice"
                        : "Note"}
                    </button>
                  )
                )}
              </div>

              {/* Module filter */}
              <select
                value={filterModule || ""}
                onChange={(e) => setFilterModule(e.target.value || null)}
                className="px-2 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-300"
              >
                <option value="">All modules</option>
                {[
                  "CIVIL_LAW",
                  "COMPANY_LAW",
                  "DATA_PROTECTION",
                  "TAX",
                  "SERVICE_LAW",
                ].map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>

              {(filterSeverity || filterDecision || filterModule) && (
                <button
                  onClick={() => {
                    setFilterSeverity(null);
                    setFilterDecision(null);
                    setFilterModule(null);
                  }}
                  className="px-2 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Comments list */}
            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {sortedComments.map((c, idx) => (
                <CommentCard key={`${c.keyword}-${idx}`} c={c} />
              ))}
              {sortedComments.length === 0 && (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No comments match the filters
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "current" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-neutral-950 z-10">
                <tr>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    Keyword
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    What is agreed
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    What I must do
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    If not done
                  </th>
                  <th className="px-2 py-2 text-right border-b border-neutral-700 text-neutral-400 font-medium">
                    Where
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysisResult.terms.current.map((term) =>
                  renderTermRow(term, false)
                )}
              </tbody>
            </table>
            {analysisResult.terms.current.length === 0 && (
              <div className="text-center py-8 text-neutral-500 text-xs">
                No current terms
              </div>
            )}
          </div>
        )}

        {activeTab === "after" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-neutral-950 z-10">
                <tr>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    Keyword
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    What is agreed
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    What I must do
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    If not done
                  </th>
                  <th className="px-2 py-2 text-right border-b border-neutral-700 text-neutral-400 font-medium">
                    Where
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysisResult.terms.after_comments.map((term) =>
                  renderTermRow(term, true)
                )}
              </tbody>
            </table>
            {analysisResult.terms.after_comments.length === 0 && (
              <div className="text-center py-8 text-neutral-500 text-xs">
                No after-comments terms
              </div>
            )}
          </div>
        )}

        {activeTab === "comparison" && (
          <div className="overflow-x-auto">
            <div className="mb-4 text-xs text-neutral-400">
              Porównanie stanu współpracy przed i po wprowadzeniu komentarzy. 
              Wszystkie aspekty współpracy z informacją o zmianach i powiązanych komentarzach.
            </div>
            <table className="min-w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-neutral-950 z-10">
                <tr>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    Keyword
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    What is agreed<br/>
                    <span className="text-[9px] font-normal text-neutral-500">(Before → After)</span>
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    What I must do<br/>
                    <span className="text-[9px] font-normal text-neutral-500">(Before → After)</span>
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    If not done<br/>
                    <span className="text-[9px] font-normal text-neutral-500">(Before → After)</span>
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    Related Comments
                  </th>
                  <th className="px-2 py-2 text-left border-b border-neutral-700 text-neutral-400 font-medium">
                    Where
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Create a map of keywords to their current and after terms
                  const keywordMap = new Map<string, {
                    current?: ContractTermEntry;
                    after?: ContractTermEntry;
                    comments: ContractComment[];
                  }>();

                  // Add current terms
                  analysisResult.terms.current.forEach((term) => {
                    const entry = keywordMap.get(term.keyword) || { comments: [] };
                    entry.current = term;
                    keywordMap.set(term.keyword, entry);
                  });

                  // Add after terms
                  analysisResult.terms.after_comments.forEach((term) => {
                    const entry = keywordMap.get(term.keyword) || { comments: [] };
                    entry.after = term;
                    keywordMap.set(term.keyword, entry);
                  });

                  // Add comments
                  analysisResult.comments.forEach((comment) => {
                    const entry = keywordMap.get(comment.keyword);
                    if (entry) {
                      entry.comments.push(comment);
                    }
                  });

                  // Convert to array and sort by keyword
                  const comparisonRows = Array.from(keywordMap.entries())
                    .map(([keyword, data]) => ({ keyword, ...data }))
                    .sort((a, b) => a.keyword.localeCompare(b.keyword));

                  return comparisonRows.map((row) => {
                    const problem = keywordToProblem.get(row.keyword);
                    const hasChanges = row.current && row.after && (
                      row.current.what_is_agreed !== row.after.what_is_agreed ||
                      row.current.what_i_must_do !== row.after.what_i_must_do ||
                      row.current.if_not_done !== row.after.if_not_done
                    );
                    const rowClassName = `border-b border-neutral-800 hover:bg-neutral-900/50 transition-colors ${getRowHighlight(problem?.severity_pl)} ${hasChanges ? 'bg-blue-950/10' : ''}`;

                    return (
                      <tr key={row.keyword} className={rowClassName}>
                        <td className="align-top py-2 px-2 text-xs font-medium text-neutral-100">
                          <div className="flex items-center gap-1.5">
                            {problem && <SeverityDot severity={problem.severity_pl} />}
                            <span className="font-mono text-[10px]">{row.keyword}</span>
                            {hasChanges && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-200 border border-blue-700/60">
                                CHANGED
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="align-top py-2 px-2 text-[11px]">
                          <div className="space-y-1">
                            <div className="text-neutral-300">
                              <span className="text-[9px] text-neutral-500">Before: </span>
                              {row.current?.what_is_agreed || <span className="text-neutral-600 italic">N/A</span>}
                            </div>
                            {hasChanges && (
                              <div className="text-emerald-300 border-l-2 border-emerald-600 pl-2">
                                <span className="text-[9px] text-emerald-500">After: </span>
                                {row.after?.what_is_agreed}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="align-top py-2 px-2 text-[11px]">
                          <div className="space-y-1">
                            <div className="text-neutral-300">
                              <span className="text-[9px] text-neutral-500">Before: </span>
                              {row.current?.what_i_must_do || <span className="text-neutral-600 italic">N/A</span>}
                            </div>
                            {hasChanges && (
                              <div className="text-emerald-300 border-l-2 border-emerald-600 pl-2">
                                <span className="text-[9px] text-emerald-500">After: </span>
                                {row.after?.what_i_must_do}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="align-top py-2 px-2 text-[11px]">
                          <div className="space-y-1">
                            <div className="text-neutral-300">
                              <span className="text-[9px] text-neutral-500">Before: </span>
                              {row.current?.if_not_done || <span className="text-neutral-600 italic">N/A</span>}
                            </div>
                            {hasChanges && (
                              <div className="text-emerald-300 border-l-2 border-emerald-600 pl-2">
                                <span className="text-[9px] text-emerald-500">After: </span>
                                {row.after?.if_not_done}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="align-top py-2 px-2 text-[10px]">
                          {row.comments.length > 0 ? (
                            <div className="space-y-1">
                              {row.comments.map((comment, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1 mb-1 p-1 rounded bg-neutral-800/50 border border-neutral-700"
                                >
                                  <SeverityBadge severity={comment.severity_pl} />
                                  {comment.decision_flag && (
                                    <DecisionBadge flag={comment.decision_flag} />
                                  )}
                                  <span className="text-[9px] text-neutral-400 truncate flex-1">
                                    {comment.where_in_contract && comment.where_in_contract !== 'brak' && (
                                      <span className="text-neutral-500">({comment.where_in_contract}) </span>
                                    )}
                                    {comment.risk_short || comment.suggested_change_summary.substring(0, 40)}...
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-neutral-600 italic text-[9px]">No comments</span>
                          )}
                        </td>
                        <td className="align-top py-2 px-2 text-[10px] text-neutral-500">
                          <div className="space-y-1">
                            {row.current?.where_in_contract && (
                              <div>
                                <span className="text-[9px] text-neutral-600">Before: </span>
                                {row.current.where_in_contract}
                              </div>
                            )}
                            {row.after?.where_in_contract && row.after.where_in_contract !== row.current?.where_in_contract && (
                              <div>
                                <span className="text-[9px] text-neutral-600">After: </span>
                                {row.after.where_in_contract}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            {analysisResult.terms.current.length === 0 && analysisResult.terms.after_comments.length === 0 && (
              <div className="text-center py-8 text-neutral-500 text-xs">
                No terms to compare
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

