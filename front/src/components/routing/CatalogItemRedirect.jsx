import { Navigate, useParams } from "react-router-dom";

const CatalogItemRedirect = () => {
  const { id } = useParams();
  return <Navigate to={id ? `/catalog/${id}` : "/catalog"} replace />;
};

export default CatalogItemRedirect;
