export interface HealthStatus {
  status: "ok";
}

export interface ReadyStatus {
  status: "ok" | "not_ready";
  database: "connected" | "unreachable";
}
