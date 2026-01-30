import { useParams } from 'react-router-dom'

export const LobbyScreen = () => {
  const { matchId } = useParams<{ matchId: string }>()
  
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Lobby</h1>
      <p>Match ID: {matchId}</p>
      <p>Coming soon in Phase 4</p>
    </div>
  )
}
