import { useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
        <h1 className="text-4xl font-bold mb-4 text-foreground">{t('notFound.title')}</h1>
        <p className="text-xl text-muted-foreground mb-4">{t('notFound.message')}</p>
        <Link to="/" className="text-primary hover:text-primary/80 underline">
          {t('notFound.returnHome')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
