import RefsTablePagination from "./RefsTablePagination";

export default function FamillesPagination(props) {
  return (
    <RefsTablePagination
      entityLabel="famille"
      selectAriaLabel="Familles par page"
      {...props}
    />
  );
}
