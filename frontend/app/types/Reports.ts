// TypeScript types for report data structures based on controls_json.py

export interface ControlOccurrence {
  severity: string;
  status: string; // 'ok' | 'ko' | 'not_started' | 'in_progress' | 'not_applicable'
  confidence: string | null;
  details: Record<string, any>;
}

export interface ObservationOccurrence {
  severity: string;
  confidence: string | null;
  details: Record<string, any>;
}

export interface ControlDefinition {
  name: string;
  max_severity: string;
  status: string;
  total_status_ok: number;
  total_status_ko: number;
  confidence: string;
  total_occurrences: number;
  occurrences: ControlOccurrence[];
  all_keys: string[];
}

export interface ObservationDefinition {
  name: string;
  max_severity: string;
  confidence: string;
  total_occurrences: number;
  occurrences: ObservationOccurrence[];
  all_keys: string[];
}

export interface SeverityStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  unknown: number;
}

export interface Summary {
  total_control_definitions: number;
  total_control_occurrences: number;
  total_observations_definitions: number;
  total_observations_occurrences: number;
  controls_definitions_by_severity: SeverityStats;
  observations_definitions_by_severity: SeverityStats;
  observations_occurrences_by_severity: SeverityStats;
}

export interface ControlsJsonReport {
  controls: ControlDefinition[];
  observations: ObservationDefinition[];
  summary: Summary;
}

export interface Reporter {
  name: string;
}
