"""Utility functions for transforming Census data into Chart.js format."""


def census_to_chartjs(raw_data: list[list[str]], title: str = "Census Data") -> dict:
    """Convert Census API response (header + rows) to Chart.js bar chart format."""
    if not raw_data or len(raw_data) < 2:
        return {}

    headers = raw_data[0]
    rows = raw_data[1:]

    # Find the NAME column and data columns
    name_idx = headers.index("NAME") if "NAME" in headers else 0
    data_cols = [i for i, h in enumerate(headers) if h not in ("NAME", "state", "county", "place", "us")]

    labels = [row[name_idx] for row in rows]
    datasets = []
    colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]

    for idx, col_i in enumerate(data_cols):
        values = []
        for row in rows:
            try:
                values.append(float(row[col_i]))
            except (ValueError, IndexError):
                values.append(0)
        datasets.append({
            "label": headers[col_i],
            "data": values,
            "backgroundColor": colors[idx % len(colors)],
        })

    return {
        "type": "bar",
        "title": title,
        "data": {"labels": labels, "datasets": datasets},
    }
