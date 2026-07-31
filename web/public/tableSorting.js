// jQuery table sorting
$(document).ready(function () {
    $(document).on("click", "table th", function () {
        const $header = $(this);
        const $table = $header.closest("table");
        const $tbody = $table.children("tbody");
        const rows = $tbody.children("tr").get();
        const isAsc = !$header.hasClass("sort-asc");
        const type = $header.data("type");
        const columnIndex = $header.index();

        // Remove sort classes from headers in this table only
        $table.find("th").removeClass("sort-asc sort-desc");

        // Add the correct sort class to the clicked header
        $header.addClass(isAsc ? "sort-asc" : "sort-desc");

        rows.sort(function (a, b) {
            const cellA = $(a).children("td").eq(columnIndex).text().trim();
            const cellB = $(b).children("td").eq(columnIndex).text().trim();

            if (type === "date") {
                const dateA = new Date(cellA).getTime();
                const dateB = new Date(cellB).getTime();
                return isAsc ? dateA - dateB : dateB - dateA;
            }

            if (type === "number") {
                const numA = parseFloat(cellA);
                const numB = parseFloat(cellB);
                return isAsc ? numA - numB : numB - numA;
            }

            return isAsc
                ? cellA.localeCompare(cellB)
                : cellB.localeCompare(cellA);
        });

        $tbody.append(rows);
    });
});