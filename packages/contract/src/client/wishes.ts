import {
  type WishesResponse,
  type WishSeekersResponse,
  wishesResponseSchema,
  wishSeekersResponseSchema,
} from "../index";
import { ApiError, type Http, json, parse, segment } from "./http";

export function wishRoutes(http: Http) {
  const { sendAsPlayer } = http;
  return {
    async fetchWishes(): Promise<WishesResponse> {
      const response = await sendAsPlayer("/me/wishes");
      if (!response.ok) throw new ApiError("wishes_unavailable", response.status);
      return parse(response, wishesResponseSchema);
    },

    /** Takes a word off the list; done again, changes nothing. */
    async removeWish(cardId: string): Promise<void> {
      const response = await sendAsPlayer(`/me/wishes/${segment(cardId)}`, json("DELETE"));
      if (!response.ok) throw new ApiError("wish_not_removed", response.status);
    },

    async fetchWishSeekers(): Promise<WishSeekersResponse> {
      const response = await sendAsPlayer("/me/wish-seekers");
      if (!response.ok) throw new ApiError("wish_seekers_unavailable", response.status);
      return parse(response, wishSeekersResponseSchema);
    },
  };
}
