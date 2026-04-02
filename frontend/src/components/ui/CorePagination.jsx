import { Paginator } from "primereact/paginator";

export default function CorePagination({ first = 0, rows = 10, totalRecords = 0, onPageChange, ...rest }) {
  return (
    <Paginator
      first={first}
      rows={rows}
      totalRecords={totalRecords}
      onPageChange={onPageChange}
      template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      rowsPerPageOptions={[10, 20, 50]}
      {...rest}
    />
  );
}
