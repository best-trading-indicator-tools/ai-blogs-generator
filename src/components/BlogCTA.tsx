import { trackDownloadClick } from '../../google-analytics';

const BlogCTA = () => {
  const handleDownloadClick = (platform: 'App Store' | 'Google Play') => {
    trackDownloadClick(`BLOG_${platform.replace(' ', '_').toUpperCase()}`);
  };

  return (
    <div className="my-8 p-6 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl text-white text-center max-w-xl mx-auto">
      <h3 className="text-2xl font-bold mb-4 text-white">Ready to Break Free from Sugar?</h3>
      <p className="mb-6 text-gray-200">
        Join thousands of others who have successfully overcome their sugar cravings with STOPPR. 
        Our science-backed approach helps you regain control and live a healthier life.
      </p>
      <div className="flex justify-center items-center space-x-3 mt-4">
        <a
          href="https://apps.apple.com/us/app/stoppr-stop-sugar-now/id6742406521?platform=iphone"
          onClick={() => handleDownloadClick('App Store')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-transform duration-200 hover:scale-105 w-32 sm:w-36 md:w-40"
        >
          <img
            src="/images/svg/Download_on_the_App_Store_Badge.svg"
            alt="Download on the App Store"
            className="h-10 w-auto mx-auto hover:opacity-80 transition-opacity"
            width="120" height="40"
          />
        </a>

        <a
          href="https://play.google.com/store/apps/details?id=com.stoppr.app"
          onClick={() => handleDownloadClick('Google Play')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-transform duration-200 hover:scale-105 w-32 sm:w-36 md:w-40"
        >
          <img
            src="/images/svg/Google_Play_Store_badge_EN.svg"
            alt="Get it on Google Play"
            className="h-10 w-auto mx-auto hover:opacity-80 transition-opacity"
            width="120" height="40"
          />
        </a>
      </div>
    </div>
  );
};

export default BlogCTA; 