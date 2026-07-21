
export interface UserProfile {
  "id": string;
    "name": string;
    "account": {
      "account_number": string;
      "classification": string;
      "date_created": string;
      "day_trader": boolean;
      "option_level": number;
      "status": string;
      "type": string;
      "last_update_date": string;
    }
}
export interface GetUserProfileResponse {
  "profile": UserProfile;
}