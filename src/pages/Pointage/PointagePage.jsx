import { useAuth }        from '../../hooks/useAuth'
import PointageOuvrierPage from './PointageOuvrierPage'
import PointagePatronPage  from './PointagePatronPage'
import PointageChefPage    from './PointageChefPage'

export default function PointagePage() {
  const { role } = useAuth()
  if (role === 'patron' || role === 'comptable') return <PointagePatronPage />
  if (role === 'chef_equipe')                   return <PointageChefPage />
  return <PointageOuvrierPage />
}
