export default function pageFactice(nom) {
  return function PageFactice() {
    return <h1>{nom}</h1>;
  };
}
