// jQuery table sorting
$(document).ready(function () {
    $("#myTable th").each(function (columnIndex) {
        $(this).on("click", function () {
            let table = $(this).parents("table").eq(0);
            let tbody = table.find("tbody");
            let rows = tbody.find("tr").toArray();
            let isAsc = !$(this).hasClass("sort-asc");
            let type = $(this).data("type");

            // Remove sort classes from all headers
            table.find("th").removeClass("sort-asc sort-desc");

            // Add the correct sort class to the clicked header
            $(this).addClass(isAsc ? "sort-asc" : "sort-desc");

            rows.sort(function (a, b) {
                let cellA = $(a).children("td").eq(columnIndex).text().trim();
                let cellB = $(b).children("td").eq(columnIndex).text().trim();
                // Detect date vs numeric vs text
                if (type === "date") {
                    let dateA = new Date(cellA).getTime();
                    let dateB = new Date(cellB).getTime();
                    return isAsc ? dateA - dateB : dateB - dateA;
                } else if (type === "number") {
                    let numA = parseFloat(cellA);
                    let numB = parseFloat(cellB);
                    return isAsc ? numA - numB : numB - numA;
                } else {
                    return isAsc
                        ? cellA.localeCompare(cellB)
                        : cellB.localeCompare(cellA);
                }
            });

            // Append sorted rows back to tbody
            $.each(rows, function (_, row) {
                tbody.append(row);
            });
        });
    });
});