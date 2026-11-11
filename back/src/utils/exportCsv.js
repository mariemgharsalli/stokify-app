const { Parser } = require("json2csv");

function toCsv(res, data, fields, filename) {
  try {
    const parser = new Parser({ fields, delimiter: ";", withBOM: true });
    const csv = parser.parse(data);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[exportCsv]", filename, err);
    return res.status(500).json({ message: "Erreur export CSV", detail: err.message });
  }
}

module.exports = { toCsv };
