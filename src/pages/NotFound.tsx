import { useLocation } from "react-router-dom";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
        <h1 className="text-4xl font-bold mb-4">{t('notFound.title')}</h1>
        <p className="text-xl text-gray-600 mb-4">{t('notFound.message')}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {t('notFound.returnHome')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
