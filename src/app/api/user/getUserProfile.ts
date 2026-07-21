import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetUserProfileResponse, UserProfile } from "./getUserProfileResponse";

export async function getUserProfile(config: RuntimeConfig): Promise<UserProfile> {
    const url = "{apiBaseUrl}/v1/user/profile"
        .replace('{apiBaseUrl}', config.API_BASE_URL);

    const response = await fetch(url, { headers: buildHeaders(config) });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GetUserProfileResponse;
    return data.profile;
}