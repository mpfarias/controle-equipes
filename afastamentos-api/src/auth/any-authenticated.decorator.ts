import { SetMetadata } from '@nestjs/common';

export const ANY_AUTHENTICATED_KEY = 'anyAuthenticated';

export const AnyAuthenticated = () => SetMetadata(ANY_AUTHENTICATED_KEY, true);
