import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import ArticleDetailModal from "./components/ArticleDetailModal";
import ClientArticleDetail from "../client/ClientArticleDetail";

/** Route /articles/:id — fiche client redesignée ou modal admin. */
export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const numericId = Number(id);
  const valid = Number.isInteger(numericId) && numericId > 0;

  if (!valid) {
    navigate("/articles", { replace: true });
    return null;
  }

  if (role === "CLIENT") {
    return <ClientArticleDetail articleId={numericId} />;
  }

  return (
    <ArticleDetailModal
      articleId={numericId}
      open
      onClose={() => navigate("/articles")}
      onEdit={(article) => {
        navigate({
          pathname: "/articles",
          search: `?edit=${article.id}`,
          hash: "product-editor",
        });
      }}
    />
  );
}
