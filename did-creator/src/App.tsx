import { Utils } from '@bsv/sdk'
import './App.css'
import { doctorIdentityKey, medicalIdentityKey, medicalPromise, doctorPromise } from './context/wallets'
import { useState } from 'react'

const medicalLicense = Utils.toBase64(Utils.toArray('Título de Médico', 'utf8'))

function App() {
  const [medicalCertificate, setMedicalCertificate] = useState<any>(null)
  

  const handleRegister = async () => {
    const medical = await medicalPromise
    const doctor = await doctorPromise
    try {
      console.log('Acquiring certificate...')
      const certificate = await doctor.acquireCertificate({
        acquisitionProtocol: 'issuance',
        certifier: medicalIdentityKey,
        certifierUrl: 'http://localhost:3000',
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
      console.log('Certificate acquired:', certificate)
      setMedicalCertificate(certificate)
    } catch (error) {
      console.error('failed to acquire certificate', error)
    }
  }

  return (
    <>
      <h1>Register</h1>
      <button onClick={handleRegister}>Register Doctor</button>
      
      {medicalCertificate && (
        <div style={{ marginTop: '20px', maxWidth: '800px', overflow: 'auto' }}>
          <h3>Medical Certificate</h3>
          <pre>{JSON.stringify(medicalCertificate, null, 2)}</pre>
        </div>
      )}
    </> 
  )
}

export default App
