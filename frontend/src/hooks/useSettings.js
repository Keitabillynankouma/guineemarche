/**
 * useSettings — lit les paramètres globaux du site depuis /api/v1/core/settings/
 * Mis en cache 5 minutes, lecture seule depuis le frontend utilisateur.
 */
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const DEFAULTS = {
  free_listings_enabled:  true,
  subscriptions_enabled:  false,
  max_free_listings:      5,
  commission_pct:         4,
  escrow_enabled:         true,
  shop_approval_required: true,
  whatsapp_contact:       '',
  site_name:              'GuinéeMarché',
  tagline:                'Le marché en ligne de la Guinée',
  maintenance_mode:       false,
  maintenance_message:    '',
}

export function useSettings() {
  const { data, isLoading } = useQuery({
    queryKey:    ['site-settings'],
    queryFn:     () => api.get('/core/settings/').then(r => r.data),
    staleTime:   5 * 60 * 1000,   // 5 min
    gcTime:      10 * 60 * 1000,  // 10 min
    retry:       false,
  })

  return {
    settings:  { ...DEFAULTS, ...data },
    isLoading,
  }
}
