import { Utils } from '@bsv/sdk'
import './App.css'
import { doctorIdentityKey, medicalIdentityKey, medicalPromise, doctorPromise } from './context/wallets'

const medicalLicense = Utils.toBase64(Utils.toArray('Título de Médico', 'utf8'))

function App() {
  

  const handleRegister = async () => {
    const medical = await medicalPromise
    const doctor = await doctorPromise
    const certificate = await doctor.acquireCertificate({
      acquisitionProtocol: 'issuance',
      certifier: medicalIdentityKey,
      certifierUrl: 'https://localhost:3000',
      type: medicalLicense,
      fields: {
        subject: doctorIdentityKey,
        date: new Date().toISOString(),
        medicalSchool: 'some school',
        residency: 'some residency',
        licenseNumber: 'some license number',
      }
    })
    // create an identity token within the identity-services overlay
    

  }

  return (
    <>
      <h1>Register</h1>
      <button onClick={handleRegister}>Register Doctor</button>
    </> 
  )
}

export default App
