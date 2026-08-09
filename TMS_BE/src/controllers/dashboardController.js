import * as dashboardService from "../services/dashboardService.js";

export const getReports = async (req, res) => {
  const { team_id: teamId, period = "all" } = req.query;

  const reports = await dashboardService.getDashboardReports(req.user.user_id, {
    teamId: teamId ? Number(teamId) : null,
    period,
  });

  res.json({ reports });
};
