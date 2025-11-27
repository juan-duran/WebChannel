declare module 'crypto-js' {
  namespace CryptoJS {
    namespace lib {
      type WordArray = any;
    }
    namespace enc {
      const Base64: {
        stringify(wordArray: any): string;
        parse(base64: string): any;
      };
      const Utf8: {
        stringify(wordArray: any): string;
      };
    }
    function HmacSHA256(message: string, secret: string): lib.WordArray;
  }
  const CryptoJS: typeof CryptoJS;
  export default CryptoJS;
}
